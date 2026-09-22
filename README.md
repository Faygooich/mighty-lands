# МОЩНЫЕ ЗЕМЛИ

Настольная игра на 2–7 игроков о росте **МОЩИ** и захвате Земель. Её ДНК — жизни из БЭНГ!, поле Монополии, взаимодействие Манчкина и «цифры мощи» мобильных игр.

Правила получены **эволюционным плейтестингом**: 22 поколения, ≈ 3.1 млн симулированных партий, 14 зарегистрированных проблем с регрессией в каждом поколении, holdout на новых seeds.

| Документ | Что внутри |
|---|---|
| [`docs/final_rules.md`](docs/final_rules.md) | **Полные правила** (для печати) |
| [`docs/tutorial.md`](docs/tutorial.md) | Обучение за 10 минут с примерами |
| [`docs/balance_report.md`](docs/balance_report.md) | Цифры баланса на новых seeds |
| [`docs/design_analysis.md`](docs/design_analysis.md) | Что осталось от исходной идеи, что удалено и почему |
| [`docs/changelog.md`](docs/changelog.md) | v001 → v015 |
| [`docs/generations/gen_001.md` … `gen_022.md`](docs/generations/) | Отчёт каждого поколения |
| [`docs/initial_analysis.md`](docs/initial_analysis.md), [`docs/assumptions.md`](docs/assumptions.md), [`docs/quality_criteria.md`](docs/quality_criteria.md) | Этап 0: анализ, допущения, критерии |
| [`docs/final_audit.md`](docs/final_audit.md) | Финальный аудит |

## Требования

Node.js ≥ 23.6 (движок запускается напрямую из TypeScript, без сборки). Проверено на Node 24.

```bash
npm install                 # TypeScript для проверки типов
npm test                    # 44 теста движка, правил v015 и web-интеграции
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
node game/balancing/evolve.ts final v015   # финальный holdout на новых seeds
```

Поколение: training (все кандидаты) → выбор по скору `docs/quality_criteria.md` → validation → holdout (только отчёт) → `rules/vNNN.json` → регрессия всех BUG-NNN → `docs/generations/gen_NNN.md` → git commit.

## Web-версия

```bash
cd game/web
npm install
npm run dev          # http://localhost:5173
npm run build        # статическая сборка в game/web/dist
```

Режимы: **игра против ботов**, **локальная игра** за одним экраном (2–7 человек), **режим симуляции** в браузере, загрузка партии по коду (seed + ходы — основа для онлайн-мультиплеера). `?watch=4` — демо-партия ботов.

Иллюстрации монстров и карт — встроенные SVG. Любую можно заменить своей картинкой: положите файл в `game/web/src/art/custom/` под именем из таблицы [`game/web/src/art/README.md`](game/web/src/art/README.md), например `card-fireball.png` или `land-meadow.webp`.

Web использует **тот же движок** (`game/core`, `game/cards`, боты) и тот же файл правил (`rules/resolved/v015.json`). Правила в UI не дублируются; тест `game/tests/web_integration.test.ts` это проверяет.

## Архитектура

```
game/core        GameState, движок-генератор (решения → выбор), токены, RNG (sfc32, seed)
game/cards       каталог Артефактов и Заклятий
game/rules       RuleSet (все правила как данные), загрузка версий
game/simulation  боты, раннер, worker_threads-пул, CLI, бенчмарк
game/statistics  метрики партии, агрегаты, скор, детектор проблем, Human Table Test
game/balancing   эволюция, поиск эксплойтов, набор экспериментов
game/tests       unit / регрессия / интеграция
game/web         React + Vite UI поверх того же движка
rules/           v001…v015 (изменения) + resolved/ (полные наборы)
results/         агрегированная статистика поколений, реестр багов
replays/         реплеи аномальных партий
```
