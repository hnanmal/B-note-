import urllib.request

resp = urllib.request.urlopen(
    "http://localhost:8000/api/v1/family-list/1/calc-dictionary"
)
print(resp.status)
print(resp.read().decode())
