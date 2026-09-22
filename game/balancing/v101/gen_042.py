import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from plans_v101 import cand, write

TT = lambda ex, dec: {"explain": ex, "noCalculator": True, "noWriting": True, "tempEffects": 0, "onComponent": True, "visible": True, "notSlow": True, "decision": dec, "cognitive": "низкая", "arithmetic": "нет", "lookup": "памятка", "bookkeeping": "нет", "tableTime": "нет"}
def rule(cid, title, extra, ex, dec):
    c = cand(cid, title, extra=extra, rationale=title)
    c['tabletop'] = TT(ex, dec)
    return c

write(42, {
  "base": "v026",
  "focus": "Финальное поколение v1.0.1: правила, которые раньше были в зоне равенства, на итоговой колоде (с «Отстающим» и 12 новыми картами).",
  "observations": "Gen 41: изменений нет. Без Оков −3.2: пропуск хода остаётся нужным наказанием. Без Исцеления ×1 −0.1 (равенство, тай-брейк оставил карту). Без Телепорта Interest 80.0, но вариант не прошёл ворота: скор 98.1, качели сильнее. Исцеление ×2 в зоне равенства.\n\nВ Gen 33 «2 Заклятия за ход», «побег 4–6» и «рука 4» проверялись на колоде без «Отстающего». С тех пор рука отстающего стала больше, и ответ мог измениться.",
  "hypotheses": "H1. С «Отстающим» у отстающего больше карт, и 2 Заклятия за ход помогут ему их реализовать.\nH2. Побег 4–6 смягчит потери слабых стилей.\nH3. Рука 4 теперь полезнее, потому что карт больше.",
  "candidates": [
    rule("A", "2 Заклятия за ход", {"spellsPerTurn": 2}, "«За ход можно сыграть до 2 Заклятий.»", "комбинации карт"),
    rule("B", "Побег на 4–6", {"fleeMin": 4}, "«Бежать: 4–6 — ушли.»", "бежать или рискнуть Отвагой"),
    rule("C", "Лимит руки 4", {"handLimit": 4}, "«В конце хода на руке не больше 4 карт.»", "что держать"),
    rule("D", "Побег 4–6 + рука 4", {"fleeMin": 4, "handLimit": 4}, "«Бежать 4–6; рука до 4 карт.»", "оба"),
  ],
  "sideEffects": "—",
  "next": "Финал: holdout на свежих seeds, сравнение v1.0.0 и v1.0.1, документы и web-версия.",
})
