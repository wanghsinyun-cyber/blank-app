#!/usr/bin/perl
# lint-asi.pl — 抓「return（或 throw）後面只剩註解，值換到下一行」
#
# 第 9 輪吃過一次：把一段說明插在 return 與字串之間，
#
#     return /* … */
#     '<div class="likert">…' + …;
#
# JavaScript 的自動分號補齊會在 return 後面那個換行插上分號，於是整個
# .map() 每一項都回 undefined、.join('') 得到空字串——問卷 47 題一題都
# 不印，而且沒有任何例外、沒有語法錯誤、build 也照過。
# 括號平衡與字串終結兩支 linter 都看不到這個形狀。
#
# 規則：一行以 return / throw 結尾（後面可以再接一段註解，但不能有分號
# 或值），而下一個「有東西的行」不是 }、) 、註解或另一個語句開頭 —— 就報。

use strict;
use warnings;

my $bad = 0;

for my $file (@ARGV) {
  open my $fh, '<', $file or die "$file: $!\n";
  my @lines = <$fh>;
  close $fh;

  for my $i (0 .. $#lines) {
    my $l = $lines[$i];
    chomp $l;

    # 去掉行尾註解（區塊與行註解都算），看看剩下什麼
    my $stripped = $l;
    $stripped =~ s{/\*.*?\*/}{ }g;      # 同一行內閉合的區塊註解
    $stripped =~ s{//.*$}{};            # 行註解
    $stripped =~ s/\s+$//;

    # 這一行「實際的程式碼」必須正好以 return 或 throw 結尾，
    # 而且前面是行首或區塊開頭（避免命中字串裡的 return）
    next unless $stripped =~ /(?:^|[{};:)]\s*|\A\s*)\b(return|throw)$/;
    my $kw = $1;

    # 原始行若本來就沒有註解，那是單純的 `return`（合法的提早返回），
    # 只有在後面掛了註解時才可疑——但兩種情形下一行都不該是值。
    my $j = $i + 1;
    $j++ while $j <= $#lines && $lines[$j] =~ /^\s*$/;
    last if $j > $#lines;
    my $next = $lines[$j];
    chomp $next;
    $next =~ s/^\s+//;

    # 下一行是收尾、註解或新的語句開頭 → 這是合法的提早返回
    next if $next =~ m{^(\}|\)|/\*|//|\bcase\b|\bdefault\b)};

    $bad++;
    printf "%s:%d: %s 後面只剩註解，值在下一行——ASI 會在這裡補上分號\n",
           $file, $i + 1, $kw;
    print  "    $l\n";
    print  "    $next\n";
  }
}

exit($bad ? 1 : 0);
