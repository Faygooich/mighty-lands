import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from plans_v101 import cand, write

S = {"fireball": 4, "heal": 3, "shatter": 3, "usurp": 3, "teleport": 2, "drain": 3, "aid": 5, "hex": 4, "swap": 3, "luxuryTax": 2, "revolt": 2, "ambush": 2, "intercept": 2, "courage": 2}
def sp(add, **chg):
    d = dict(S); d.update(chg); d.update(add); return {k: v for k, v in d.items() if v > 0}

write(32, {
  "base": "v021",
  "focus": "Оставшиеся карты — замена «один к одному»: новая карта встаёт на место старой с похожей ролью.",
  "observations": "Gen 31: цель 5 Земель на 7 игроков (v021). Партия 7p 94 → 55 мин, MEDIUM len7p закрыт. Партий ≤ 4 раундов на 7p 2.5% (LOW). На 4p ничего не изменилось.\n\nНе вошли в игру: Зеркало, Трофей, Приманка, Кузня, Попутный Ветер, Охотничий Рог, Землетрясение, Второе Дыхание. В Gen 29 Зеркало (73.2) и Приманка + Кузня (72.7) были рядом с базой (73.1) — в пределах шума.",
  "hypotheses": "H1. Карта, которая делает то же, что старая, но с выбором, лучше старой: Трофей вместо Разрушения, Попутный Ветер или Зеркало вместо Телепорта, Кузня или Второе Дыхание вместо Исцеления.\nH2. Землетрясение вместо части Огненных шаров — take-that по богатым вместо адресного.",
  "candidates": [
    cand("A", "Зеркало 2 вместо Телепорта 2", spells=sp({"mirror": 2}, teleport=0), cards=['mirror'], rationale="Защитный ответ вместо движения."),
    cand("B", "Трофей 2 вместо 2 Разрушений (Разрушение 1)", spells=sp({"loot": 2}, shatter=1), cards=['loot'], rationale="Снять Артефакт и забрать себе."),
    cand("C", "Кузня 2 вместо 2 Исцелений (Исцеление 1)", spells=sp({"forge": 2}, heal=1), cards=['forge'], rationale="Рост мощи вместо HP."),
    cand("D", "Попутный Ветер 2 вместо Телепорта 2", spells=sp({"tailwind": 2}, teleport=0), cards=['tailwind'], rationale="Выбор из двух бросков вместо любой клетки."),
    cand("E", "Второе Дыхание 2 вместо 2 Исцелений (Исцеление 1)", spells=sp({"secondWind": 2}, heal=1), cards=['secondWind'], rationale="Лечение только для отстающих, зато крупное."),
    cand("F", "Землетрясение 2 вместо 2 Огненных шаров (Шар 2)", spells=sp({"quake": 2}, fireball=2), cards=['quake'], rationale="Урон по богатым вместо адресного."),
  ],
  "sideEffects": "Если убрать Телепорт, пропадёт карта-«ход конём» из v1.0.0.",
  "next": "Gen 33: правила — лимит руки, Заклятий за ход.",
})
