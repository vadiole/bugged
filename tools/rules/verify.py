import sys

rules_path, redirects_path, cases_path = sys.argv[1:4]
rules = {}
for i, line in enumerate(open(rules_path).read().split('\n')[:-1]):
    parts = line.split(' ')
    assert len(parts) >= 2 and all(parts), f'rules bad line {i+1}: {line!r}'
    assert parts[0] == parts[0].lower(), parts[0]
    assert parts[0] not in rules, f'dup host {parts[0]}'
    rules[parts[0]] = parts[1:]
hosts = list(rules)
assert hosts[0] == '*' and hosts[1:] == sorted(hosts[1:]), 'order'

redirects = []
for line in open(redirects_path).read().split('\n')[:-1]:
    parts = line.split(' ')
    assert len(parts) >= 2 and all(parts), line
    host, _, path = parts[0].partition('/')
    redirects.append((host, '/' + path, parts[1:]))

lines = open(cases_path).read().split('\n')[:-1]
for i, line in enumerate(lines):
    assert len(line.split(' ')) == 2, f'case {i+1} format'
same = sum(1 for l in lines if l.split(' ')[0] == l.split(' ')[1])
print(f'{len(lines)} cases, {same} unchanged; {len(rules)} rule lines, {len(redirects)} redirects')
