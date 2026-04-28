import requests


class APIClient:
    def __init__(self, base_url="https://admin.dom-automation.ru"):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })

    def login(self, username, password):
        try:
            resp = self.session.post(
                self.base_url + "/",
                data={"authorization_login": username, "authorization_pass": password},
                timeout=15,
                allow_redirects=True,
            )
            if resp.status_code == 200 and "authorization_login" not in resp.text and len(resp.text) > 8000:
                return True, "OK"
            return False, "Неверный логин или пароль"
        except requests.exceptions.ConnectionError:
            return False, "Нет соединения с сервером"
        except Exception as e:
            return False, str(e)

    def get_categories(self):
        try:
            resp = self.session.get(
                self.base_url + "/ajax/get.php",
                params={"module": "mod_categories", "fget": "tree", "getFormat": "json"},
                timeout=15,
            )
            raw = resp.json()
            if not isinstance(raw, list):
                return []
            result = []
            for item in raw:
                meta = item.get("metadata") if isinstance(item, dict) else None
                if meta and "id" in meta:
                    result.append({
                        "id":     str(meta["id"]),
                        "name":   meta.get("name", str(meta["id"])),
                        "parent": str(meta.get("parent") or "0"),
                    })
                elif isinstance(item, dict) and "id" in item:
                    result.append({
                        "id":     str(item["id"]),
                        "name":   item.get("name", str(item["id"])),
                        "parent": str(item.get("parent") or "0"),
                    })
            return result
        except Exception:
            return []

    def get_goods(self, rows=3000):
        try:
            resp = self.session.post(
                self.base_url + "/ajax/get.php",
                params={"module": "mod_goods", "getFormat": "json", "page": 1, "rows": rows},
                data={"_search": "false", "sidx": "name", "sord": "asc", "page": 1, "rows": rows},
                timeout=30,
            )
            data = resp.json()
            if isinstance(data, list):
                return [g for g in data if str(g.get("archived", "0")) == "0"]
            return []
        except Exception as e:
            print(f"get_goods error: {e}")
            return []
