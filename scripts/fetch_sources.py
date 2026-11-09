"""Download the original documents this project is built on, from their official sources.

They are not kept in the repository because they belong to their publishers
(permits, studies, company reports) or carry no stated licence (the register snapshot).
Every source with a "localCopy" in data/baseline.json or data/thedalles.json is fetched
to that path; PDFs also get a plain-text copy next to them if `pdftotext` is installed.

Run:  python3 scripts/fetch_sources.py           (skips files that already exist)
      python3 scripts/fetch_sources.py --force   (downloads everything again)
"""
import json, pathlib, shutil, ssl, subprocess, sys, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
UA = {"User-Agent": "datacenter-teardown/1.0 (fetch_sources.py)"}
FORCE = "--force" in sys.argv
RZREG_API = "https://rechenzentrumsregister.bund.de/api/portal-d/datacenters"


def get(url):
    req = urllib.request.Request(url, headers=UA)
    try:
        return urllib.request.urlopen(req, timeout=60).read()
    except urllib.error.URLError as e:
        if "CERTIFICATE" not in str(e).upper():
            raise
        # the register's server has sent an incomplete certificate chain in the past
        print("   certificate could not be verified; retrying without verification (public data, read only)")
        return urllib.request.urlopen(req, timeout=60, context=ssl._create_unverified_context()).read()


def fetch_register(dest):
    """All sites of Germany's datacenter register, 25 per page (the API rejects larger pages)."""
    sites, page = [], 1  # pages start at 1
    while True:
        batch = json.loads(get(f"{RZREG_API}?pager%5Bsize%5D=25&pager%5Bpage%5D={page}"))["data"]
        if not batch:
            break
        sites += batch
        page += 1
    dest.write_text(json.dumps(sites, ensure_ascii=False, indent=1))
    print(f"   {len(sites)} sites")


def main():
    todo = {}
    for name in ("baseline.json", "thedalles.json"):
        for key, s in json.loads((ROOT / "data" / name).read_text())["sources"].items():
            local = s.get("localCopy")
            if local and not local.endswith("/") and s.get("url"):
                todo[local] = (key, s["url"])
    failed = []
    for local, (key, url) in sorted(todo.items()):
        dest = ROOT / local
        if dest.exists() and not FORCE:
            print(f"ok    {local}")
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        print(f"get   {local}  ({key})")
        try:
            if key == "rzreg":
                fetch_register(dest)
            else:
                dest.write_bytes(get(url))
            if dest.suffix == ".pdf" and shutil.which("pdftotext"):
                subprocess.run(["pdftotext", "-layout", str(dest), str(dest.with_suffix(".txt"))], check=False)
        except Exception as e:  # keep going; report at the end
            failed.append((local, url, e))
            print(f"   failed: {e}")
    if failed:
        print("\nCould not download (the publisher may have moved the file; search for its title):")
        for local, url, e in failed:
            print(f" - {local}\n   {url}")
        sys.exit(1)
    print("\nAll sources present.")


if __name__ == "__main__":
    main()
