import os
from dotenv import load_dotenv
from apify_client import ApifyClient

# טוען .env (מהתיקייה הנוכחית ומעלה)
load_dotenv()

token = os.getenv("APIFY_API_TOKEN")
print("TOKEN:", token)

client = ApifyClient(token)
print(client.user().get())
