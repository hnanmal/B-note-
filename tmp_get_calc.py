import http.client

conn = http.client.HTTPConnection("localhost", 8000)
conn.request("GET", "/api/v1/family-list/1/calc-dictionary")
resp = conn.getresponse()
print(resp.status)
print(resp.read().decode())
