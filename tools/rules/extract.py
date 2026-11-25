import json, re, sys, os
from collections import defaultdict

S = sys.argv[1]
out = open(sys.argv[2], 'w')
stats = defaultdict(lambda: [0, 0])

def emit(src, host, param, scoped=''):
    host = host.lower().strip('.')
    if host.startswith('www.'):
        host = host[4:]
    out.write(f'{src}\t{host}\t{param.lower()}\t{scoped}\n')
    stats[src][0] += 1

def skip(src):
    stats[src][1] += 1

def expand_regex_names(rx):
    rx = rx.strip()
    rx = rx.replace('(?:%3F)?', '').replace('(?:%3f)?', '')
    rx = re.sub(r'\(\?:_\[a-z_\]\*\)\?$', '_*', rx)
    rx = re.sub(r'(\[a-z_\][*+]|\[a-z\]\*|\[a-z\]\+)$', '*', rx)
    rx = rx.replace('p[fd]_rd_', 'pX_rd_')
    if rx.startswith('pX_rd_'):
        return ['pf_rd_*', 'pd_rd_*']
    m = re.fullmatch(r'([\w\-]*)\(\?:([\w\-|]+)\)([\w\-*]*)', rx)
    if m:
        return [m.group(1) + x + m.group(3) for x in m.group(2).split('|')]
    if re.fullmatch(r'[\w\-]+\*', rx):
        return [rx]
    rx = re.sub(r'^\^', '', rx)
    rx = re.sub(r'(=|\$)$', '', rx).rstrip('$').rstrip('=')
    if re.fullmatch(r'[\w\-.%\[\]]+', rx):
        return [rx]
    m = re.fullmatch(r'\(\?:?([\w\-|]+)\)|\(([\w\-|]+)\)', rx)
    if m:
        return (m.group(1) or m.group(2)).split('|')
    m = re.fullmatch(r'([\w\-]*)\((?:\?:)?([\w\-|]+)\)([\w\-]*)', rx)
    if m:
        return [m.group(1) + x + m.group(3) for x in m.group(2).split('|')]
    m = re.fullmatch(r'([\w\-]+)(?:\.\*|\[\^=&\]\*|\\w\*|\[a-z0-9_\]\*|\[a-z\]\*|\.\+)', rx)
    if m:
        return [m.group(1) + '*']
    return None

def adblock(src, path):
    for line in open(path, encoding='utf-8', errors='replace'):
        line = line.strip()
        if not line or line[0] in '!#[' or line.startswith('@@') or 'removeparam' not in line:
            continue
        m = re.match(r'^(.*?)\$(.*)$', line)
        if not m:
            skip(src); continue
        pattern, opts = m.groups()
        rp = None
        domains = []
        for o in re.split(r',(?=[~\w-]+(?:=|,|$))', opts):
            if o.startswith('removeparam') or o.startswith('queryprune'):
                rp = o.split('=', 1)[1] if '=' in o else ''
            elif o.startswith('domain=') or o.startswith('from='):
                domains = [d for d in o.split('=', 1)[1].split('|') if not d.startswith('~')]
        if rp is None or rp == '' or rp.startswith('~'):
            skip(src); continue
        hosts = []
        hm = re.match(r'^\|\|([a-z0-9.\-*]+)(.*)$', pattern)
        scoped = ''
        if hm:
            hosts = [hm.group(1)]
            rest = hm.group(2)
            if rest not in ('', '^', '^*', '*', '/', '^|'):
                scoped = 'path'
        elif pattern in ('', '*', '|http*', '|https://'):
            hosts = domains or ['*']
        else:
            skip(src); continue
        if rp.startswith('/'):
            names = expand_regex_names(rp[1:rp.rfind('/')])
        else:
            names = [rp]
        if not names:
            skip(src); continue
        for h in hosts:
            if '*' in h and h != '*':
                h = h.replace('*.', '').replace('.*', '.TLD')
                if '*' in h:
                    skip(src); continue
            for n in names:
                emit(src, h, n, scoped)

def ext_list(src, path):
    for e in json.load(open(path)):
        for inc in e['include']:
            m = re.match(r'^\*://(?:\*\.)?([^/]+)/(.*)$', inc)
            if not m:
                skip(src); continue
            host = m.group(1)
            scoped = '' if m.group(2) in ('*', '') else 'path'
            for p in e['params']:
                emit(src, host, p, scoped)

def clearurls(src, path):
    d = json.load(open(path))['providers']
    for name, p in d.items():
        up = p['urlPattern']
        if name == 'globalRules':
            hosts = ['*']
        else:
            m = re.search(r'\)\*\?(.*)$', up) or re.search(r'https\?:\\/\\/(.*)$', up)
            core = m.group(1) if m else up
            core = re.split(r'\\/', core)[0]
            core = core.replace('\\.', '.')
            core = re.sub(r'\(\?:\.\[a-z\]\{2,\}\)\{1,\}', '.TLD', core)
            core = re.sub(r'\(\?:\.\[a-z\]\{2,\}\)\+', '.TLD', core)
            alt = re.fullmatch(r'\(\?:([\w\-.|]+)\)(.*)', core)
            if alt:
                hosts = [a + alt.group(2) for a in alt.group(1).split('|')]
            else:
                hosts = [core]
            hosts = [h for h in hosts if re.fullmatch(r'[a-z0-9.\-]+(?:\.TLD)?', h)]
            if not hosts:
                skip(src); continue
        for r in p.get('rules', []) + p.get('referralMarketing', []):
            names = expand_regex_names(r)
            if names is None:
                skip(src); continue
            for h in hosts:
                for n in names:
                    emit(src, h, n, 'ref' if r in p.get('referralMarketing', []) else '')
        for rd in p.get('redirections', []):
            out_rd.write(f'{src}\t{",".join(hosts)}\t{rd}\n')

def neat(src, path):
    for c in json.load(open(path))['categories']:
        for p in c['params']:
            if '@' in p:
                n, h = p.split('@', 1)
                h = h.replace('*.', '').replace('.*', '.TLD')
            else:
                n, h = p, '*'
            if (h != '*' and '*' in h) or '!' in n or '$' in n:
                skip(src); continue
            emit(src, h, n)

def firefox(src, path):
    for r in json.load(open(path))['data']:
        for p in r['stripList']:
            emit(src, '*', p)

out_rd = open(sys.argv[2] + '.redirects', 'w')
adblock('adguard_general', f'{S}/adguard/filter.txt')
adblock('adguard_specific', f'{S}/adguard2/specific.txt')
adblock('ubo_privacy', f'{S}/ubo/privacy.txt')
adblock('alleg', f'{S}/alleg/legitimate-url-shortener.txt')
ext_list('brave_qf', f'{S}/brave/query-filter.json')
ext_list('brave_clean', f'{S}/brave/clean-urls.json')
clearurls('clearurls', f'{S}/clearurls2/data.min.json')
neat('neat', f'{S}/neat/default-params-by-category.json')
firefox('firefox', f'{S}/firefox/qps.json')
for k, (a, b) in stats.items():
    print(f'{k}: {a} facts, {b} skipped', file=sys.stderr)
