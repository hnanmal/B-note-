from backend.main import app
from fastapi.testclient import TestClient

client = TestClient(app)
for path in [
	"/api/v1/family-list/1/calc-dictionary",
	"/api/v1/standard-items/",
	"/api/v1/work-masters/",
]:
	response = client.get(path)
	print(path, response.status_code)
