import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from plans_v101 import cand, write

S0 = {"fireball": 5, "heal": 6, "shatter": 5, "usurp": 3, "teleport": 3, "drain": 3, "aid": 6, "hex": 7, "swap": 3, "luxuryTax": 2}
def sp(add, **chg):
    d = dict(S0); d.update(chg); d.update(add); return d

write(26, {
  "base": "v017",
  "focus": "v1.0.1, этап 4: карты-ответы, которые играются в чужой ход (Манчкин-момент): Зеркало, Засада, Отвага, Перехват.",
  "observations": "Gen 25: темповые Заклятия отклонены. Содержательных решений больше (1.69 → 1.84), разнообразие карт выше, но Ветер, Рог и Кузня ускоряют того, кто уже впереди. Лидер comeback-теста 60% → 62–66%, последний в середине 5.0% → 3.6–4.2%, прямого взаимодействия меньше. B (Ветер + Приманка) был в зоне равенства на training и не подтвердился на validation (63.9 против 65.2).\n\nВ v017 в чужой ход играются только Подмога и Помеха (8.9 карт за партию).",
  "hypotheses": "H1. Зеркало и Засада дают реакцию на take-that и на визит — больше «Ха! А у меня есть…».\nH2. Отвага превращает безнадёжный бой (6 из 6) в честную ставку (3 из 6) — Бездна становится достижимой без мощи.\nH3. Перехват — Манчкин-кража награды — повод для мести.",
  "candidates": [
    cand("A", "Все 4 ответа ×3", spells=sp({"mirror": 3, "ambush": 3, "courage": 3, "intercept": 3}), cards=['mirror', 'ambush', 'courage', 'intercept'], rationale="Полный набор ответов."),
    cand("B", "Засада 3, Перехват 3", spells=sp({"ambush": 3, "intercept": 3}), cards=['ambush', 'intercept'], rationale="Только атакующие ответы."),
    cand("C", "Зеркало 3, Отвага 3", spells=sp({"mirror": 3, "courage": 3}), cards=['mirror', 'courage'], rationale="Защита и риск в своём бою."),
    cand("D", "Все 4 ×3, Помеха 7 → 5, Исцеление 6 → 4", spells=sp({"mirror": 3, "ambush": 3, "courage": 3, "intercept": 3}, hex=5, heal=4), cards=['mirror', 'ambush', 'courage', 'intercept'], rationale="Колода не раздувается; реакций в чужой ход столько же, но разных."),
    cand("E", "Засада 3, Отвага 3, Перехват 2", spells=sp({"ambush": 3, "courage": 3, "intercept": 2}), cards=['ambush', 'courage', 'intercept'], rationale="Без Зеркала (отмена гасит эмоции take-that)."),
  ],
  "sideEffects": "Больше решений «играть или беречь» в чужой ход — чуть медленнее за столом.",
  "next": "Gen 27: повторная проверка отложенных карт (Алтарь, Соглядатай, Жила, Бунт, Второе Дыхание, Трофей, Землетрясение) на новой базе.",
})
