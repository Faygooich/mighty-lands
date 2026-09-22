# МОЩНЫЕ ЗЕМЛИ

Настольная игра на 2–7 игроков о росте **МОЩИ** и захвате Земель. Её ДНК — жизни из БЭНГ!, поле Монополии, взаимодействие Манчкина и «цифры мощи» мобильных игр.

**Текущая версия — v1.0.3** (правила `v029`, механика не менялась): добавлена **игра по сети** — комната с кодом из четырёх букв, как в Jackbox, но у каждого своё устройство и своя рука; боты на свободных местах, зрители, переподключение на своё место. Как это устроено и где разместить — [`docs/multiplayer.md`](docs/multiplayer.md).

**v1.0.2** (правила `v029`, механика v1.0.1 без изменений): вся игра переписана как предельно серьёзный эпос о культе МОЩИ, который на поверку оказывается его пародией. Звания от «Хиляка» до «МУЖИКОТАВРА», Одуванчик-Задира, Дуб-Мотиватор и Кракен в Бане. 23 типа карт, правило «Ярость Отстающего». Правила получены **эволюционным плейтестингом**: 44 поколения (22 — для v1.0.0, 22 — для v1.0.1), ≈ 11 млн симулированных партий, регрессия всех зарегистрированных проблем в каждом поколении, holdout на новых seeds.

**v1.0.0 или v1.0.1?** → [`docs/v1.0.1_comparison.md`](docs/v1.0.1_comparison.md). Коротко: v1.0.1 интереснее (Interest 56 → 82, у отстающего появился шанс, вдвое больше карт в чужой ход), но на ~10 минут дольше и с вдвое большим числом карт. v1.0.0 сохранена: git-тег `v1.0.0`, [`docs/final_rules_v1.0.0.md`](docs/final_rules_v1.0.0.md), папка `../МОЩНЫЕ ЗЕМЛИ v1.0.0 (backup)`. v1.0.1 (до ребрендинга) — git-тег `v1.0.1`, папка `../МОЩНЫЕ ЗЕМЛИ v1.0.1 (backup)`.

| Документ | Что внутри |
|---|---|
| [`docs/final_rules.md`](docs/final_rules.md) | **Кодекс МОЩИ — полные правила** (для печати) |
| [`docs/multiplayer.md`](docs/multiplayer.md) | **Игра по сети v1.0.3**: как играть, как устроена комната, что скрыто, где разместить |
| [`docs/style_guide.md`](docs/style_guide.md) | **Стиль-гайд v1.0.2**: эстетика, словарь терминов, Шкала МОЩИ, таблица переименований, проверка механики |
| [`docs/v1.0.1_comparison.md`](docs/v1.0.1_comparison.md) | **v1.0.0 против v1.0.1**: вердикт, цифры, судьба 20 карт-кандидатов |
| [`docs/cards.md`](docs/cards.md) | Летопись Карт и Земель: тексты всех карт, Земель и монстров |
| [`docs/tutorial.md`](docs/tutorial.md) | Обучение за 10 минут с примерами |
| [`docs/balance_report.md`](docs/balance_report.md) | Цифры баланса на новых seeds |
| [`docs/design_analysis.md`](docs/design_analysis.md) | Что осталось от исходной идеи, что удалено и почему |
| [`docs/changelog.md`](docs/changelog.md) | v001 → v029 |
| [`docs/generations/gen_001.md` … `gen_044.md`](docs/generations/) | Отчёт каждого поколения (23–44 — цикл v1.0.1) |
| [`docs/initial_analysis.md`](docs/initial_analysis.md), [`docs/assumptions.md`](docs/assumptions.md), [`docs/quality_criteria.md`](docs/quality_criteria.md) | Этап 0: анализ, допущения, критерии |
| [`docs/final_audit.md`](docs/final_audit.md) | Финальный аудит |

## Требования

Node.js ≥ 23.6 (движок запускается напрямую из TypeScript, без сборки). Проверено на Node 24.

```bash
npm install                 # TypeScript для проверки типов
npm test                    # 69 тестов: движок, правила v015, новые карты v1.0.1, web-интеграция
npm run typecheck
```

## Симуляции

```bash
# 10 000 партий на 4 игроков, смешанные боты, все ядра
npm run sim -- --games 10000

# 7 игроков, конкретные боты, 4 воркера
npm run sim -- --players 7 --games 3000 --workers 4

# одна партия с полным логом (реплей по seed) → replays/
npm run sim -- --replay 12345

# targeted-сценарии: lowHp, highHp, extremeEconomy, lateGame, earlyLead, poorStart
npm run sim -- --scenario earlyLead --bots tactical,tactical,tactical,tactical

npm run bench               # замер games/s и оптимального числа воркеров
```

## Эволюционный цикл

```bash
node game/balancing/evolve.ts explore v015 '{"handLimit":5}' 0.3   # быстрая проверка идеи на TRAINING seeds
node game/balancing/evolve.ts gen 23       # поколение по плану docs/generations/plans/gen_023.json
node game/balancing/evolve.ts final v029   # финальный holdout на новых seeds
node game/balancing/compare.ts v015 v029   # сравнение двух версий на свежих seeds → docs/v1.0.1_comparison_data.md
```

Поколение: training (все кандидаты) → выбор (до Gen 22 — по скору, с Gen 23 — ревизия R4: скор = ворота, выбор по Interest Index, см. `docs/quality_criteria.md`) → validation → holdout (только отчёт) → `rules/vNNN.json` → регрессия всех BUG-NNN → `docs/generations/gen_NNN.md`. Планы поколений v1.0.1 генерируются скриптами `game/balancing/v101/gen_NNN.py`.

## Web-версия

```bash
cd game/web
npm install
npm run dev          # http://localhost:5173
npm run build        # статическая сборка в game/web/dist
```

Режимы: **игра по сети** (комната с кодом, у каждого своё устройство — см. [`docs/multiplayer.md`](docs/multiplayer.md)), **игра против ботов**, **локальная игра** за одним экраном (2–7 человек), **режим симуляции** в браузере, загрузка партии по коду (seed + ходы). `?watch=4` — демо-партия ботов, `?room=ABCD` — вход в комнату по ссылке.

```bash
# свой сервер комнат (он же раздаёт сборку; годится и для домашней сети)
VITE_ROOM_SERVER=same npm --prefix game/web run build
npm run server                 # http://localhost:8080
npm run uicheck                # браузерная проверка сетевой игры (нужен Firefox или Chrome)
```

Иллюстрации монстров и карт — встроенные SVG. Любую можно заменить своей картинкой: положите файл в `game/web/src/art/custom/` под именем из таблицы [`game/web/src/art/README.md`](game/web/src/art/README.md), например `card-fireball.png` (Огненный Шар Гнева) или `land-meadow.webp` (Луг Слабаков).

Web использует **тот же движок** (`game/core`, `game/cards`, боты) и тот же файл правил (`rules/resolved/v029.json`). Правила в UI не дублируются; тест `game/tests/web_integration.test.ts` это проверяет.

## Архитектура

```
game/core        GameState, движок-генератор (решения → выбор), токены, RNG (sfc32, seed)
game/cards       каталог Артефактов и Заклятий
game/rules       RuleSet (все правила как данные), загрузка версий
game/simulation  боты, раннер, worker_threads-пул, CLI, бенчмарк
game/statistics  метрики партии, агрегаты, скор, детектор проблем, Human Table Test
game/balancing   эволюция, поиск эксплойтов, набор экспериментов
game/tests       unit / регрессия / интеграция
game/net         сетевая игра: протокол, комната (авторитетный движок), скрытие, клиент, свой сервер
game/web         React + Vite UI поверх того же движка (+ src/net: PeerJS/WebSocket, лобби, сессии)
rules/           v001…v029 (изменения) + resolved/ (полные наборы); v015 = v1.0.0, v029 = v1.0.1
results/         агрегированная статистика поколений, реестр багов
replays/         реплеи аномальных партий
```
