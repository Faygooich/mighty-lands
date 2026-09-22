import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from plans_v101 import cand, write

S = {"fireball": 4, "heal": 1, "shatter": 3, "usurp": 3, "teleport": 2, "drain": 3, "aid": 5, "hex": 4, "swap": 3, "luxuryTax": 1, "ambush": 2, "intercept": 2, "courage": 2, "secondWind": 2}
NAMES = {"swap": "Подмена", "luxuryTax": "Налог на Роскошь", "ambush": "Засада", "intercept": "Перехват", "courage": "Отвага", "secondWind": "Второе Дыхание"}
def without(c):
    d = dict(S); k = d.pop(c); d["aid"] += k; return d

write(40, {
  "base": "v026",
  "focus": "Проверка «по одной» — Заклятия: Подмена, Налог на Роскошь, Засада, Перехват, Отвага, Второе Дыхание.",
  "observations": "Gen 39: все шесть новых Артефактов остаются. Без любого из них Interest ниже базы на 0.9–3.0: без Зависти −3.0, без Песков −2.4, без Мимика −1.9, без Соглядатая −1.7, без Жилы −1.4, без Алтаря −0.9. Сильнее всего от каждого удаления страдают разнообразие (19.5 → 18.1–18.5) и шансы последнего места.",
  "hypotheses": "H0. Каждое новое Заклятие нужно. Если без какого-то Interest не ниже базы, карту убираем, а её копии отдаём Подмоге.",
  "candidates": [cand(chr(65 + i), f"Без карты «{NAMES[c]}» (копии → Подмога)", spells=without(c), rationale=f"Нужна ли {NAMES[c]}?") for i, c in enumerate(["swap", "luxuryTax", "ambush", "intercept", "courage", "secondWind"])],
  "sideEffects": "—",
  "next": "Gen 41: старые карты v1.0.0 в новой колоде.",
})
