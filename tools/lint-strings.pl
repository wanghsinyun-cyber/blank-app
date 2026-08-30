#!/usr/bin/env perl
# 找出「單引號字串在行尾沒有關起來」的行。
#
# 這一類錯誤已經發生兩次：用指令碼把多行中文塞進 JS 字串時，換行留在引號
# 裡面，整份 dist 變成 SyntaxError——而瀏覽器只說「Invalid or unexpected
# token」，不指哪一行，全站所有函式一起消失（typeof buildSeedState 變成
# undefined）。靜態掃描比事後在瀏覽器裡追便宜得多。
use strict;
use warnings;
use utf8;
binmode(STDOUT, ':encoding(UTF-8)');

my $bad = 0;
for my $f (@ARGV) {
    open(my $fh, '<:encoding(UTF-8)', $f) or die "$f: $!";
    my $inblock = 0;
    my $ln      = 0;
    while (my $l = <$fh>) {
        $ln++;
        my $s = $l;
        chomp $s;

        # 區塊註解
        if ($inblock) {
            if ($s =~ m{\*/}) { $s =~ s{^.*?\*/}{}; $inblock = 0; }
            else              { next; }
        }
        while ($s =~ m{/\*}) {
            if   ($s =~ m{/\*.*?\*/}) { $s =~ s{/\*.*?\*/}{}; }
            else { $s =~ s{/\*.*$}{}; $inblock = 1; last; }
        }
        $s =~ s{//.*$}{} unless $s =~ m{https?://};

        # 逐字掃。要同時追蹤三種引號，否則 "story's mood" 這種
        # 雙引號字串裡的撇號會被誤判；正規表示式字面量（/'/g）也要跳過。
        my $q     = 0;    # 單引號內
        my $dq    = 0;    # 雙引號內
        my $bq    = 0;    # 樣板字串內
        my $prev  = '';   # 上一個非空白字元，用來判斷 / 是除號還是正規表示式
        my @c     = split //, $s;
        for (my $i = 0 ; $i < @c ; $i++) {
            my $ch = $c[$i];
            if ($ch eq '\\') { $i++; next; }
            if (!$dq && !$bq && $ch eq "'")  { $q  = !$q;  $prev = $ch; next; }
            if (!$q  && !$bq && $ch eq '"')  { $dq = !$dq; $prev = $ch; next; }
            if (!$q  && !$dq && $ch eq '`')  { $bq = !$bq; $prev = $ch; next; }
            if (!$q && !$dq && !$bq && $ch eq '/'
                && $prev =~ /^[\(\,\=\:\!\&\|\?\{\;\[]$|^$/) {
                # 正規表示式字面量：跳到未跳脫的收尾斜線
                $i++;
                while ($i < @c) {
                    last if $c[$i] eq '/' && $c[$i - 1] ne '\\';
                    $i++;
                }
                $prev = '/';
                next;
            }
            $prev = $ch if $ch =~ /\S/;
        }
        if ($q) {
            print "$f:$ln: 單引號字串沒有在行尾關起來\n";
            print "    $l";
            $bad++;
        }

        # 另一種同源錯誤：指令碼把 perl 的字串串接運算子留在原始碼裡
        # （「 . "…"」或「 . function …」）。合法的鏈式呼叫是 .sort(...)
        # ——點後面緊接識別字、不會有空白，所以用「點加空白」就分得開。
        if ($s =~ /^\s*\.\s/) {
            print "$f:$ln: 行首有落單的「. 」，看起來是指令碼留下的字串串接運算子\n";
            print "    $l";
            $bad++;
        }
    }
    close $fh;
}

if ($bad) {
    print "\n共 $bad 行。JS 的單引號字串不可以跨行。\n";
    exit 1;
}
exit 0;
