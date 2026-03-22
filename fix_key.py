# -*- coding: utf-8 -*-
import re

with open(r'C:\Users\admin\.openclaw\workspace\bishe-cp\src\App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove key="cabin" and key="mobile"
content = content.replace('<CabinUI key="cabin"', '<CabinUI')
content = content.replace('<MobileUI key="mobile"', '<MobileUI')

with open(r'C:\Users\admin\.openclaw\workspace\bishe-cp\src\App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done!')
