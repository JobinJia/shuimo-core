#!/bin/bash
# Fix TypeScript errors using optional chaining (?.)

cd /Users/jiabinbin/myself/github/shuimo-core/packages/shanshui/src

# Function to add optional chaining to array accesses
fix_file() {
    local file=$1
    echo "Fixing $file..."
    
    # Fix patterns like: array[i][0] -> array[i]?.[0]
    # Fix patterns like: array[i][1] -> array[i]?.[1]
    perl -i -pe 's/(\w+)\[([^\]]+)\]\[0\]/\1[\2]?.[0]/g' "$file"
    perl -i -pe 's/(\w+)\[([^\]]+)\]\[1\]/\1[\2]?.[1]/g' "$file"
    
    # Fix specific patterns for nested accesses
    # ptlist[i][j] -> ptlist[i]?.[j]
    perl -i -pe 's/ptlist\[i\]\[j\]/ptlist[i]?.[j]/g' "$file"
    perl -i -pe 's/plist\[i\]\[0\]/plist[i]?.[0]/g' "$file"
    perl -i -pe 's/plist\[i\]\[1\]/plist[i]?.[1]/g' "$file"
    
    # Fix nslist accesses
    perl -i -pe 's/nslist\[i\]\[0\]/nslist[i]?.[0]/g' "$file"
    perl -i -pe 's/nslist\[i\]\[1\]/nslist[i]?.[1]/g' "$file"
    
    # Fix trlist accesses
    perl -i -pe 's/trlist\[0\]\[i\]/trlist[0]?.[i]/g' "$file"
    perl -i -pe 's/trlist\[1\]\[i\]/trlist[1]?.[i]/g' "$file"
    
    # Fix lalist, brklist, etc
    perl -i -pe 's/lalist\[i\]\[0\]/lalist[i]?.[0]/g' "$file"
    perl -i -pe 's/lalist\[i\]\[1\]/lalist[i]?.[1]/g' "$file"
    
    # Fix tlist accesses
    perl -i -pe 's/tlist\[i\]\[0\]/tlist[i]?.[0]/g' "$file"
    perl -i -pe 's/tlist\[i\]\[1\]/tlist[i]?.[1]/g' "$file"
    
    # Fix trlistCombined accesses
    perl -i -pe 's/trlistCombined\[i\]\[0\]/trlistCombined[i]?.[0]/g' "$file"
    perl -i -pe 's/trlistCombined\[i\]\[1\]/trlistCombined[i]?.[1]/g' "$file"
    
    # Fix brlist accesses
    perl -i -pe 's/brlist\[0\]\[j\]\[0\]/brlist[0]?.[j]?.[0]/g' "$file"
    perl -i -pe 's/brlist\[0\]\[j\]\[1\]/brlist[0]?.[j]?.[1]/g' "$file"
    perl -i -pe 's/brlist\[1\]\[j\]\[0\]/brlist[1]?.[j]?.[0]/g' "$file"
    perl -i -pe 's/brlist\[1\]\[j\]\[1\]/brlist[1]?.[j]?.[1]/g' "$file"
    
    # Fix rglist accesses
    perl -i -pe 's/rglist\[i\]\[j\]\[0\]/rglist[i]?.[j]?.[0]/g' "$file"
    perl -i -pe 's/rglist\[i\]\[j\]\[1\]/rglist[i]?.[j]?.[1]/g' "$file"
    
    # Fix grlist accesses
    perl -i -pe 's/grlist1\[0\]\[0\]/grlist1[0]?.[0]/g' "$file"
    perl -i -pe 's/grlist1\[0\]\[1\]/grlist1[0]?.[1]/g' "$file"
    perl -i -pe 's/grlist2\[0\]\[0\]/grlist2[0]?.[0]/g' "$file"
    perl -i -pe 's/grlist2\[0\]\[1\]/grlist2[0]?.[1]/g' "$file"
    
    # Fix du, dd, dl, dr accesses
    perl -i -pe 's/du\[hsp\[0\]\]/du[hsp[0] ?? 0]/g' "$file"
    perl -i -pe 's/dd\[hsp\[0\]\]/dd[hsp[0] ?? 0]/g' "$file"
    
    # Fix slist accesses
    perl -i -pe 's/slist\[0\]/slist[0] ?? 0/g' "$file"
    perl -i -pe 's/slist\[1\]/slist[1] ?? 0/g' "$file"
    perl -i -pe 's/slist\[2\]/slist[2] ?? 0/g' "$file"
    
    # Fix cuts array accesses
    perl -i -pe 's/cuts\[i\]\[0\]/cuts[i]?.[0]/g' "$file"
}

# Fix all material files
fix_file "material/tree.ts"
fix_file "material/arch.ts"
fix_file "material/mount.ts"
fix_file "material/man.ts"
fix_file "material/blob.ts"
fix_file "material/div.ts"
fix_file "material/stroke.ts"
fix_file "material/texture.ts"
fix_file "poly-tools/index.ts"
fix_file "utils/index.ts"

echo "Optional chaining fixes applied to all files"
