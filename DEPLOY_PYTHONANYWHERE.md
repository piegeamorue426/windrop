# Deployer Windrop sur PythonAnywhere (GRATUIT A VIE)

## Etape 1 : Creer un compte
1. Va sur https://www.pythonanywhere.com
2. Clique "Start running Python online in less than a minute!"
3. Cree un compte gratuit (choisis ton username, ex: "windrop")
4. Ton site sera accessible sur : https://TONUSERNAME.pythonanywhere.com

## Etape 2 : Uploader les fichiers
1. Va dans l'onglet "Files"
2. Va dans /home/TONUSERNAME/
3. Cree un dossier "windrop" (clique "New directory")
4. Upload TOUS les fichiers du projet dans ce dossier :
   - database.py
   - routes.py
   - wsgi.py
   - seed_data.py
5. Cree le sous-dossier "static" et uploade tout le contenu :
   - static/index.html
   - static/css/style.css
   - static/js/app.js
   - static/js/admin.js
   - static/images/placeholder.svg

## Etape 3 : Initialiser la base de donnees
1. Va dans l'onglet "Consoles"
2. Clique "Bash" pour ouvrir un terminal
3. Tape :
```
cd ~/windrop
python seed_data.py
```
4. Tu devrais voir "Database seeded successfully!"

## Etape 4 : Configurer le Web App
1. Va dans l'onglet "Web"
2. Clique "Add a new web app"
3. Clique "Next" (accepte le domaine gratuit)
4. Choisis "Manual configuration"
5. Choisis "Python 3.10"
6. Clique "Next"

## Etape 5 : Configurer WSGI
1. Dans la section "Code", clique sur le lien du fichier WSGI (ca ressemble a /var/www/TONUSERNAME_pythonanywhere_com_wsgi.py)
2. SUPPRIME tout le contenu et remplace par :
```python
import sys
import os

# Ajouter le dossier du projet au path
project_path = '/home/TONUSERNAME/windrop'
if project_path not in sys.path:
    sys.path.insert(0, project_path)

# Configurer le chemin de la base de donnees
os.environ['WINDROP_DB_PATH'] = '/home/TONUSERNAME/windrop/windrop.db'
os.environ['ADMIN_TOKEN'] = 'TON_MOT_DE_PASSE_ADMIN_SECRET'

# Importer l'application WSGI
from wsgi import application
```
3. REMPLACE "TONUSERNAME" par ton vrai username PythonAnywhere
4. REMPLACE "TON_MOT_DE_PASSE_ADMIN_SECRET" par un vrai mot de passe pour l'admin
5. Clique "Save"

## Etape 6 : Configurer les fichiers statiques
1. Toujours dans l'onglet "Web"
2. Dans la section "Static files", ajoute :
   - URL: /static/
   - Directory: /home/TONUSERNAME/windrop/static/
3. Clique la coche pour valider

## Etape 7 : Lancer le site
1. Clique le gros bouton vert "Reload" en haut de la page Web
2. Ton site est en ligne sur : https://TONUSERNAME.pythonanywhere.com
3. Tout le monde peut y acceder !

## Admin
- Va sur https://TONUSERNAME.pythonanywhere.com/#/admin
- Entre le mot de passe que tu as mis dans ADMIN_TOKEN

## En cas de probleme
- Va dans l'onglet "Web" > "Log files" > "Error log" pour voir les erreurs
- Si tu modifies un fichier, clique toujours "Reload" dans l'onglet Web

## Mettre a jour le site
- Upload les nouveaux fichiers dans "Files"
- Clique "Reload" dans l'onglet Web
- Ta base de donnees (windrop.db) n'est PAS effacee
