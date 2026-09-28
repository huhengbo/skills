#!/usr/bin/env python3
"""Small dependency-free Nezha API client. Reads credentials only from env."""
import argparse, json, os, sys
from urllib import request, parse, error

def main():
    p = argparse.ArgumentParser()
    p.add_argument('method', choices=['GET','POST','PATCH','DELETE'])
    p.add_argument('path', help='API path, e.g. /server')
    p.add_argument('--data', help='JSON request body')
    p.add_argument('--query', action='append', default=[], help='key=value')
    a = p.parse_args()
    base = os.environ.get('NEZHA_BASE_URL', '').rstrip('/')
    token = os.environ.get('NEZHA_API_TOKEN')
    if not base or not token:
        raise SystemExit('Set NEZHA_BASE_URL and NEZHA_API_TOKEN')
    path = a.path if a.path.startswith('/api/') else '/api/v1/' + a.path.lstrip('/')
    qs = dict(x.split('=',1) for x in a.query if '=' in x)
    url = base + path + (('?' + parse.urlencode(qs)) if qs else '')
    body = a.data.encode() if a.data else None
    req = request.Request(url, data=body, method=a.method, headers={'Authorization':'Bearer '+token,'Accept':'application/json','Content-Type':'application/json','User-Agent':'curl/8.0'})
    try:
        with request.urlopen(req, timeout=30) as r:
            out = r.read().decode()
            print(out)
            if r.headers.get_content_type() == 'application/json':
                obj=json.loads(out)
                if obj.get('success') is False or obj.get('error'):
                    raise SystemExit(1)
    except error.HTTPError as e:
        print(json.dumps({'http_status':e.code,'error':e.read().decode(errors='replace')}), file=sys.stderr)
        raise SystemExit(1)
if __name__ == '__main__': main()
