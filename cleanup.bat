@echo off
cd /d C:\Users\admin\.openclaw\workspace\bishe-cp
git rm deploy.bat
git commit -m "chore: remove temp script"
git push
