#!/usr/bin/env perl
# 建置前的結構檢查：括號有沒有配對。
#
# 這一類錯誤已經發生第三次，而三次的症狀完全一樣：整份 dist 變成
# 一個 SyntaxError，瀏覽器只說「Unexpected token ')'」而且不指行號，
# 於是全站每一個函式一起消失——表面看到的是「所有測試都在報
# xxx is not defined」，很容易被誤判成剛才那批改動把某個模組弄壞了。
# 前兩次是單引號字串跨行（已由 lint-strings.pl 擋下），這一次是編輯時
# 把一行結尾重複貼了一次，多出一個 ')'。引號檢查看不到它。
#
# 做法：把字串、樣板字串、正規表示式字面值與註解都跳過，只數
# () {} [] 三種括號。正規表示式與除法的區分用標準啟發式——
# 前一個有意義的 token 是識別字、數字、) 或 ] 時，'/' 是除法，否則是
# 正規表示式的開頭。這個判斷對本專案的寫法足夠（沒有任何地方會在
# 識別字後面直接接正規表示式）。
use strict;
use warnings;
use utf8;
binmode(STDOUT, ":encoding(UTF-8)");
binmode(STDERR, ":encoding(UTF-8)");

my $bad = 0;
for my $path (@ARGV) {
  open my $fh, "<:encoding(UTF-8)", $path or die "$path: $!";
  local $/;
  my $s = <$fh>;
  close $fh;

  my @stack;          # [字元, 行號]
  my $line = 1;
  my $prev = '';      # 前一個有意義的 token 類別：word / close / other
  my $i = 0;
  my $n = length $s;
  my $err = '';

  while ($i < $n) {
    my $c  = substr($s, $i, 1);
    my $c2 = substr($s, $i, 2);

    if ($c eq "\n") { $line++; $i++; next }
    if ($c =~ /\s/)  { $i++; next }

    if ($c2 eq '//') { my $j = index($s, "\n", $i); $i = $j < 0 ? $n : $j; next }
    if ($c2 eq '/*') {
      my $j = index($s, '*/', $i + 2);
      $j = $n if $j < 0;
      $line += (substr($s, $i, $j - $i) =~ tr/\n//);
      $i = $j + 2;
      next;
    }

    if ($c eq "'" or $c eq '"' or $c eq '`') {
      my $q = $c;
      $i++;
      while ($i < $n) {
        my $d = substr($s, $i, 1);
        if ($d eq "\\") { $i += 2; next }
        if ($d eq "\n") { $line++ }
        if ($d eq $q)   { $i++; last }
        $i++;
      }
      $prev = 'close';
      next;
    }

    if ($c eq '/' and $prev ne 'word' and $prev ne 'close') {
      # 正規表示式字面值
      $i++;
      my $inclass = 0;
      while ($i < $n) {
        my $d = substr($s, $i, 1);
        if ($d eq "\\") { $i += 2; next }
        if ($d eq "\n") { last }              # 不可能跨行，遇到就當它結束
        if ($d eq '[')  { $inclass = 1 }
        elsif ($d eq ']') { $inclass = 0 }
        elsif ($d eq '/' and !$inclass) { $i++; last }
        $i++;
      }
      $prev = 'close';
      next;
    }

    if ($c =~ /[\(\{\[]/) { push @stack, [$c, $line]; $prev = 'other'; $i++; next }
    if ($c =~ /[\)\}\]]/) {
      my $want = $c eq ')' ? '(' : $c eq '}' ? '{' : '[';
      my $top = pop @stack;
      if (!$top or $top->[0] ne $want) {
        $err = "第 $line 行多出來的 '$c'"
             . ($top ? "（最近未閉合的是第 $top->[1] 行的 '$top->[0]'）"
                     : '（前面沒有任何未閉合的括號）');
        last;
      }
      $prev = 'close';
      $i++;
      next;
    }

    if ($c =~ /[\w\$]/) {
      $i++;
      $i++ while $i < $n and substr($s, $i, 1) =~ /[\w\$]/;
      $prev = 'word';
      next;
    }

    $prev = 'other';
    $i++;
  }

  if (!$err and @stack) {
    $err = "有 " . scalar(@stack) . " 個括號沒有閉合，最早在第 $stack[0][1] 行的 '$stack[0][0]'";
  }
  if ($err) {
    print STDERR "$path：$err\n";
    $bad = 1;
  }
}

if ($bad) {
  print STDERR "\n括號不配對會讓整份 dist 變成一個 SyntaxError：\n";
  print STDERR "瀏覽器不指行號，全站函式一起消失，症狀是「所有東西都 undefined」。\n";
  exit 1;
}
exit 0;
