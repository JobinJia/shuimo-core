#!/bin/bash
# Fix remaining TypeScript errors

cd /Users/jiabinbin/myself/github/shuimo-core/packages/shanshui/src

# Fix the div import issue - it should be imported from Div class
sed -i '' 's/import { poly, randChoice, normRand, div,/import { poly, randChoice, normRand,/g' material/arch.ts
sed -i '' 's/, div, wtrand, randChoice, distance/, wtrand, randChoice, distance/g' material/arch.ts

# Add Div import
sed -i '' '6i\
import { Div } from '\''./div'\''
' material/arch.ts

# Replace div calls with new Div().div
sed -i '' 's/div(\([^)]*\))/new Div().div(\1)/g' material/arch.ts

# Fix man references in arch.ts (lines 921-922)
sed -i '' 's/man\.hat02/new Man().hat02/g' material/arch.ts
sed -i '' 's/man\.stick01/new Man().stick01/g' material/arch.ts

echo "Additional fixes applied"
