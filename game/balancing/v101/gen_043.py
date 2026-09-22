import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from plans_v101 import cand, write

write(43, {
  "base": "v027",
  "focus": "ERRATA. Генератор планов v1.0.1 в каждом кандидате заново записывал значения параметров новых карт по умолчанию. Из-за этого принятое в Gen 34 «Жила 500» откатилось в Gen 35, а принятое в Gen 35 «Пески на 2» — в Gen 36. Здесь оба изменения проходят ту же процедуру R4 на финальной версии.",
  "observations": "Gen 42: принят D — побег на 4–6 и лимит руки 4 (v027). Interest 79.9 → 80.1 (validation 80.1 против 79.1). 2 Заклятия за ход (A) дают Interest 84.7, но проваливают ворота (скор 97.5, 54 мин).\n\nДефект найден после Gen 41 при сверке `rules/resolved/v026.json` с журналом решений: veinIncome = 300 и quicksand = 3, хотя поколения 34–35 принимали 500 и 2. В Gen 35 у всех кандидатов, кроме E, параметр veinIncome фактически был 300, а не 500, как у базы. В Gen 36 у всех кандидатов параметр quicksand был 3, а не 2. Обе правки были на уровне шума (±0.8), поэтому выводы поколений 35–36 о «Отстающем» не меняются: его эффект +3…+8 Interest. Генератор исправлен (`plans_v101.py`, параметр `defaults`). Разведка на validation-seeds: Жила 500 +1.2, Пески 2 +1.5, оба +1.3.",
  "hypotheses": "H1. Решения Gen 34–35 были верными и подтвердятся на финальной версии. H0: разница в пределах шума, v027 не меняется.",
  "candidates": [
    cand("A", "Золотая Жила: жетон 500 (восстановить Gen 34)", extra={"params": {"veinIncome": 500}}, rationale="Errata Gen 34."),
    cand("B", "Зыбучие Пески: назад на 2 (восстановить Gen 35)", extra={"params": {"quicksand": 2}}, rationale="Errata Gen 35."),
    cand("C", "Оба", extra={"params": {"veinIncome": 500, "quicksand": 2}}, rationale="Errata Gen 34 + 35."),
  ],
  "sideEffects": "—",
  "next": "Финал: holdout на свежих seeds, сравнение v1.0.0 и v1.0.1.",
})
