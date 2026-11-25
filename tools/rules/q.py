import sys
from collections import defaultdict

FAM = {'adguard_general': 'AG', 'adguard_specific': 'AG', 'ubo_privacy': 'UBO', 'alleg': 'ALS',
       'brave_qf': 'BR', 'brave_clean': 'BR', 'clearurls': 'CU', 'neat': 'NU', 'firefox': 'FF'}
facts = [l.rstrip('\n').split('\t') for l in open(sys.argv[1])]
mode, args = sys.argv[2], sys.argv[3:]

def hmatch(h, q):
    hb = h.replace('.tld', '')
    first = q.split('.')[0]
    return h == q or h.endswith('.' + q) or (h.endswith('.tld') and (hb == first or hb.endswith('.' + first)))

if mode == 'param':
    for p in args:
        d = defaultdict(set)
        for s, h, n, sc in facts:
            if n == p:
                d[h].add(FAM[s] + ('/' + sc if sc else ''))
        print(p, '=>', '; '.join(f'{h}[{",".join(sorted(v))}]' for h, v in sorted(d.items(), key=lambda x: -len(x[1]))[:12]) or 'NONE')
elif mode == 'host':
    for q in args:
        d = defaultdict(set)
        for s, h, n, sc in facts:
            if hmatch(h, q):
                d[n].add(FAM[s] + ('/' + sc if sc else ''))
        print(f'== {q}')
        for n, v in sorted(d.items(), key=lambda x: (-len({f.split("/")[0] for f in x[1]}), x[0])):
            print(f'  {len({f.split("/")[0] for f in v})} {n} {",".join(sorted(v))}')
