#!/bin/sh
# 人の速さの bot を全区間（3本ずつ並べて）。結果は shots/hum_<区間>.txt
cd "$(dirname "$0")/.."
run() { for i in "$@"; do node tools/human.mjs $i 8 > shots/hum_$i.txt 2>/dev/null; done; }
run 0 3 6 9 &
run 1 4 7 &
run 2 5 8 &
wait
cat shots/hum_*.txt
