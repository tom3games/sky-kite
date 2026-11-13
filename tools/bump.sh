#!/bin/sh
# キャッシュ対策: js の相対 import と index.html の ?v= を全部 $1 にそろえる
V=$1
cd "$(dirname "$0")/.."
for f in js/*.js; do sed -i '' -E "s#(from '\./[a-z]+\.js)(\?v=[0-9]+)?'#\1?v=$V'#g" "$f"; done
sed -i '' -E "s#(style\.css|game\.js|og\.png)\?v=[0-9]+#\1?v=$V#g" index.html
grep -ho "?v=[0-9]*" js/*.js index.html | sort | uniq -c
