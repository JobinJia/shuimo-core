#!/bin/bash
# Comprehensive fix for TypeScript errors in shanshui package

cd /Users/jiabinbin/myself/github/shuimo-core/packages/shanshui/src

# Fix imports in tree.ts - change from instances to classes
sed -i '' 's/import { blob } from/import { Blob } from/g' material/tree.ts
sed -i '' 's/import { stroke } from/import { Stroke } from/g' material/tree.ts
sed -i '' 's/blob\.blob/new Blob().blob/g' material/tree.ts
sed -i '' 's/stroke\.stroke/new Stroke().stroke/g' material/tree.ts

# Fix imports in arch.ts
sed -i '' 's/import { stroke } from/import { Stroke } from/g' material/arch.ts
sed -i '' 's/import { texture } from/import { Texture } from/g' material/arch.ts
sed -i '' 's/import { man } from/import { Man } from/g' material/arch.ts
sed -i '' 's/stroke\.stroke/new Stroke().stroke/g' material/arch.ts
sed -i '' 's/texture\.texture/new Texture().texture/g' material/arch.ts
sed -i '' 's/man\.man/new Man().man/g' material/arch.ts

# Fix imports in mount.ts
sed -i '' 's/import { stroke } from/import { Stroke } from/g' material/mount.ts
sed -i '' 's/import { texture } from/import { Texture } from/g' material/mount.ts
sed -i '' 's/import { tree } from/import { Tree } from/g' material/mount.ts
sed -i '' 's/import { arch } from/import { Arch } from/g' material/mount.ts
sed -i '' 's/stroke\.stroke/new Stroke().stroke/g' material/mount.ts
sed -i '' 's/texture\.texture/new Texture().texture/g' material/mount.ts
sed -i '' 's/tree\.tree/new Tree().tree/g' material/mount.ts
sed -i '' 's/arch\.arch/new Arch().arch/g' material/mount.ts
sed -i '' 's/arch\.transmissionTower01/new Arch().transmissionTower01/g' material/mount.ts

# Fix imports in man.ts
sed -i '' 's/import { stroke } from/import { Stroke } from/g' material/man.ts
sed -i '' 's/stroke\.stroke/new Stroke().stroke/g' material/man.ts

# Fix imports in shanshui.ts
sed -i '' 's/import { mount } from/import { Mount } from/g' shanshui.ts
sed -i '' 's/import { arch } from/import { Arch } from/g' shanshui.ts
sed -i '' 's/import { stroke } from/import { Stroke } from/g' shanshui.ts
sed -i '' 's/mount\.mountain/new Mount().mountain/g' shanshui.ts
sed -i '' 's/mount\.flatMount/new Mount().flatMount/g' shanshui.ts
sed -i '' 's/mount\.distMount/new Mount().distMount/g' shanshui.ts
sed -i '' 's/arch\.boat01/new Arch().boat01/g' shanshui.ts
sed -i '' 's/stroke\.stroke/new Stroke().stroke/g' shanshui.ts

echo "Import fixes applied"
