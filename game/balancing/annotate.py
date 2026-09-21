# Helper: set verdict/next (or any field) of a generation plan from a JSON file, then re-render.
#   python game/balancing/annotate.py N fields.json
import json, sys, subprocess, os
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
n = int(sys.argv[1])
p = os.path.join(root, 'docs', 'generations', 'plans', f'gen_{n:03d}.json')
plan = json.load(open(p, encoding='utf8'))
plan.update(json.load(open(sys.argv[2], encoding='utf8')))
json.dump(plan, open(p, 'w', encoding='utf8'), ensure_ascii=False, indent=2)
subprocess.run(['node', os.path.join(root, 'game', 'balancing', 'evolve.ts'), 'render', str(n)], check=True)
