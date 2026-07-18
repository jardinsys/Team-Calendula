"""Flush the Chameleon test database. Run: python flush_test_db.py"""
from pymongo import MongoClient
client = MongoClient('mongodb+srv://corro:***@system-cluster.58n8wzu.mongodb.net/test')
db = client['test']
collections = db.list_collection_names()
for c in collections:
    count = db[c].count_documents({})
    if count > 0:
        print(f'  {c}: {count} docs')
client.drop_database('test')
print('✅ Test database flushed')
