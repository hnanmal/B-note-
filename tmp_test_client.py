from backend.main import app
from fastapi.testclient import TestClient

client = TestClient(app)
response = client.get("/api/v1/family-list/1/calc-dictionary")
print(response.status_code)
print(response.text)
