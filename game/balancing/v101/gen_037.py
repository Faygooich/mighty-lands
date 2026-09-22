import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from plans_v101 import cand, write

S = {"fireball": 4, "heal": 1, "shatter": 3, "usurp": 3, "teleport": 2, "drain": 3, "aid": 5, "hex": 4, "swap": 3, "luxuryTax": 1, "ambush": 2, "intercept": 2, "courage": 2, "secondWind": 2}
TT = lambda ex: {"explain": ex, "noCalculator": True, "noWriting": True, "tempEffects": 0, "onComponent": True, "visible": True, "notSlow": True, "decision": "как потратить лишнюю карту", "cognitive": "низкая", "arithmetic": "нет (сравнить флажки)", "lookup": "памятка", "bookkeeping": "нет", "tableTime": "+3 с"}
def c(cid, title, params, ex, spells=None):
    x = cand(cid, title, spells=spells, extra={"params": params}, rationale=title)
    x['tabletop'] = TT(ex)
    return x

write(37, {
  "base": "v026",
  "focus": "Качели после «Отстающего»: камбэк лидера ≈ 55% (цель ≤ 50%), официальный скор 98.8. Нужна версия правила, которая помогает последнему, но не отнимает у лидера смысл лидерства.",
  "observations": "Gen 36: принят E — «Отстающий» (меньше всех Земель → +1 Заклятие) + Налог на Роскошь ×1, Бунт убран (v026). Interest 76.7 → 79.9 (validation 79.1 против 75.3). Решений на ход 1.62 → 1.92, последний в середине 7.4% → 9.1%, партия 50 → 46 мин. Варианты с Бунтом давали Interest 83, но проваливали ворота (Q6). В игре 12 новых типов карт.\n\nС Gen 24 официальный скор накопленно опустился со 100 до 98.8, и почти вся потеря — Q6 (победитель не лидер середины в 53–55% партий).",
  "hypotheses": "H1. «Отстающий» только при отставании на 2+ Земли — правило включается реже, когда разрыв небольшой.\nH2. «Отстающий у Врат» (+1 Заклятие при проходе Врат вместо каждого хода) — в 3–4 раза реже.\nH3. С мягким правилом можно вернуть Бунт ×1.",
  "candidates": [
    c("A", "«Отстающий» только при отставании на 2+ Земли", {"catchUpGap": 2}, "«Если у вас меньше всех Земель и кто-то впереди на 2+, возьмите ещё 1 Заклятие.»"),
    c("B", "«Отстающий у Врат» вместо каждого хода", {"catchUpLands": 0, "catchUpGate": 1}, "«Проходя Врата с наименьшим числом Земель, возьмите 1 Заклятие.»"),
    c("C", "«Отстающий» (2+) + Бунт 1", {"catchUpGap": 2}, "«Отстающий» при разрыве 2+ и Бунт ×1", spells=dict(S, revolt=1)),
    c("D", "«Отстающий у Врат» + Бунт 1", {"catchUpLands": 0, "catchUpGate": 1}, "«Отстающий у Врат» и Бунт ×1", spells=dict(S, revolt=1)),
    c("E", "«Отстающий» (2+), Налог 2", {"catchUpGap": 2}, "«Отстающий» при разрыве 2+ и Налог ×2", spells=dict(S, luxuryTax=2)),
  ],
  "sideEffects": "Разрыв «на 2+» — ещё одно условие для проверки (флажки видны на поле).",
  "next": "Gen 38: поиск эксплойтов на новых картах.",
})
