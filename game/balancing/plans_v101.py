# Helper that writes generation plans for the v1.0.1 cycle (Gen 23+).
# Each generation script lives in game/balancing/v101/gen_NNN.py and calls write(). The numbers come from evolve.ts.
import json, sys, os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
PLANS = os.path.join(ROOT, 'docs', 'generations', 'plans')

PARAMS = {"veinIncome": 300, "secondWind": 500, "mimicBite": 4, "mimicGift": 300, "quicksand": 3, "courageWinOn": 4}

TT = {
    'envy': ("«Зависть: если у гостя больше Земель, чем у владельца, он отдаёт владельцу 1 жетон.»", "владелец выбирает, куда класть: против лидеров", "сравнить число флажков"),
    'quicksand': ("«Зыбучие Пески: гость отступает на 3 клетки и выполняет новую клетку.»", "где положить: позади Песков — сильный монстр или своя Засада", "нет"),
    'mimic': ("«Сундук-Мимик: гость бросает кубик — 1–4 теряет жетон, 5–6 берёт жетон 300.»", "азарт; жертва иногда выигрывает", "нет"),
    'spy': ("«Соглядатай: гость отдаёт владельцу 1 карту с руки на свой выбор.»", "какую карту не жалко отдать", "нет"),
    'altar': ("«Алтарь: гость выбирает — потерять 1 жетон или сбросить все карты.»", "жизнь против руки", "нет"),
    'vein': ("«Золотая Жила: пока она на вашей Земле, на Вратах вы берёте 300 вместо 100.»", "экономика против ловушки на Земле", "нет"),
    'secondWind': ("«Второе Дыхание: если ни у кого нет меньше Земель, чем у вас, возьмите жетон 500.»", "когда тратить догоняющую карту", "сравнить флажки"),
    'revolt': ("«Бунт: у единоличного лидера по Землям одна Земля (на ваш выбор) становится дикой.»", "какую Землю лидера освободить", "сравнить флажки"),
    'swap': ("«Подмена: заберите у соперника самый крупный жетон, отдайте ему свой самый мелкий.»", "у кого забрать", "нет"),
    'tailwind': ("«Попутный Ветер: бросьте кубик дважды и выберите результат.»", "какую клетку выбрать", "нет"),
    'loot': ("«Трофей: заберите Артефакт с чужой Земли себе в руку.»", "разрушить или присвоить", "нет"),
    'luxuryTax': ("«Налог на Роскошь: каждый, у кого Земель больше, чем у вас, отдаёт вам 1 жетон.»", "копить до максимума плательщиков", "сравнить флажки"),
    'quake': ("«Землетрясение: каждый с 4–5 жетонами (и вы) теряет 1 жетон.»", "бить по богатым, теряя своё", "посчитать жетоны"),
    'lure': ("«Приманка: соперник переносится на ближайшую дикую Землю впереди и встречает монстра.»", "кого и когда заманить (и добить Помехой)", "сравнить мощь с монстром"),
    'forge': ("«Кузня: самый мелкий жетон замените на следующий номинал.»", "когда перековать", "нет"),
    'hunt': ("«Охотничий Рог: вместо броска перейдите на ближайшую дикую Землю.»", "риск против темпа", "нет"),
    'mirror': ("«Зеркало: в чужой ход отмените Заклятие против вас или вашей Земли.»", "на что тратить защиту", "нет"),
    'ambush': ("«Засада: в чужой ход соперник, вставший на вашу Землю, теряет 1 жетон.»", "кого наказать", "нет"),
    'courage': ("«Отвага: в свой бой деритесь и побеждайте на 4–6.»", "рискнуть Бездной", "нет"),
    'intercept': ("«Перехват: в чужой ход заберите жетон-награду за побеждённого монстра.»", "чью награду перехватить", "нет"),
}


def tabletop(cards):
    ex = ' '.join(TT[c][0] for c in cards) or '—'
    return {
        "explain": ex, "noCalculator": True, "noWriting": True, "tempEffects": 1 if 'tailwind' in cards else 0,
        "onComponent": True, "visible": True, "notSlow": True,
        "decision": '; '.join(TT[c][1] for c in cards) or '—',
        "cognitive": "низкая" if len(cards) <= 3 else "средняя (новые тексты карт)",
        "arithmetic": "нет" if all(TT[c][2] == 'нет' for c in cards) else "низкая (" + ', '.join(sorted({TT[c][2] for c in cards if TT[c][2] != 'нет'})) + ")",
        "lookup": "нет (всё на карте)", "bookkeeping": "нет", "tableTime": f"+{2 * len(cards)} с на партию на прочтение новых карт",
    }


def cand(cid, title, arts=None, spells=None, extra=None, rationale='', cards=(), defaults=False):
    # ERRATA (found after Gen 41): up to Gen 42 every candidate re-sent PARAMS, which silently reset
    # params accepted earlier (Gen 34 veinIncome 500 → reset in Gen 35; Gen 35 quicksand 2 → reset in Gen 36).
    # Now defaults are sent only when asked for (the very first time the new cards enter the decks).
    o = {}
    if arts is not None or spells is not None:
        o['decks'] = {}
        if arts is not None: o['decks']['artifacts'] = arts
        if spells is not None: o['decks']['spells'] = spells
    o['params'] = dict(PARAMS) if defaults else {}
    if extra:
        for k, v in extra.items():
            if k == 'params': o['params'].update(v)
            else: o[k] = v
    return {"id": cid, "title": title, "overrides": o, "rationale": rationale, "tabletop": tabletop(list(cards))}


def write(n, plan):
    plan['generation'] = n
    with open(os.path.join(PLANS, f'gen_{n:03d}.json'), 'w', encoding='utf8') as f:
        json.dump(plan, f, ensure_ascii=False, indent=2)
    print('plan written', n)


