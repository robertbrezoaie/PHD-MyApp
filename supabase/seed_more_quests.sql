-- ============================================================
-- MORE QUESTS + BADGES SEED
-- Run in Supabase SQL Editor to add more content
-- ============================================================

-- Additional quests
insert into public.quests (title, description, tier, xp_required, xp_reward, coin_reward) values
  ('Python Basics',          'Write your first Python scripts and functions',         'bronze',  80,   800,  25),
  ('SQL Mastery',            'Write complex queries, joins, and subqueries',           'gold',    120,  1600, 55),
  ('Data Structures',        'Master arrays, linked lists, stacks and queues',         'silver',  100,  1200, 40),
  ('Algorithm Design',       'Solve classic sorting and search problems',              'diamond', 160,  2200, 80),
  ('React Native UI',        'Build polished mobile UI with animations',               'gold',    110,  1500, 50),
  ('Node.js API Builder',    'Create a REST API with Express and middleware',           'silver',  90,   1100, 35),
  ('Git & Version Control',  'Master branching, rebasing and pull requests',           'bronze',  60,   600,  20),
  ('System Design 101',      'Design scalable systems and understand trade-offs',      'diamond', 150,  2000, 75),
  ('CSS Animations',         'Create fluid transitions and keyframe animations',       'silver',  80,   1000, 30),
  ('Testing & TDD',          'Write unit, integration and end-to-end tests',           'gold',    100,  1400, 45)
on conflict do nothing;

-- Questions for new quests
insert into public.questions (quest_id, prompt, hint, xp_reward, order_num)
select q.id, 'What is the difference between a list and a tuple in Python?', 'Think about mutability.', 20, 1
from public.quests q where q.title = 'Python Basics';

insert into public.questions (quest_id, prompt, hint, xp_reward, order_num)
select q.id, 'Write a SQL query to find the top 5 users by total points using a JOIN across two tables.', 'Use ORDER BY and LIMIT.', 25, 1
from public.quests q where q.title = 'SQL Mastery';

insert into public.questions (quest_id, prompt, hint, xp_reward, order_num)
select q.id, 'Explain the time complexity of searching in a hash table vs a sorted array.', 'Think O(1) vs O(log n).', 25, 1
from public.quests q where q.title = 'Data Structures';

insert into public.questions (quest_id, prompt, hint, xp_reward, order_num)
select q.id, 'Describe the quicksort algorithm and its average-case time complexity.', 'Think divide and conquer.', 30, 1
from public.quests q where q.title = 'Algorithm Design';

insert into public.questions (quest_id, prompt, hint, xp_reward, order_num)
select q.id, 'What does git rebase do and how is it different from git merge?', 'Think about commit history.', 20, 1
from public.quests q where q.title = 'Git & Version Control';

insert into public.questions (quest_id, prompt, hint, xp_reward, order_num)
select q.id, 'What is the difference between unit tests and integration tests? Give an example of each.', 'Think about scope of what is being tested.', 25, 1
from public.quests q where q.title = 'Testing & TDD';

-- Additional badges
insert into public.badges (name, description, icon, condition_type, condition_value) values
  ('Speed Demon',    'Complete a quest in under 5 minutes',   'timer-outline',          'speed_quest',       1),
  ('Coin Hoarder',   'Accumulate 500 coins',                  'piggy-bank-outline',     'coins_total',       500),
  ('Night Owl',      'Complete tasks after 10pm',             'weather-night',          'night_task',        1),
  ('First Blood',    'Complete your very first task',         'sword-cross',            'tasks_completed',   1),
  ('Centurion',      'Complete 100 tasks total',              'shield-star-outline',    'tasks_completed',   100),
  ('Deep Diver',     'Reach Diamond tier quest',              'diamond',                'tier_reached',      1),
  ('Bookworm',       'Read all available quests',             'book-open-page-variant', 'quests_viewed',     10),
  ('Unstoppable',    'Maintain a 30-day streak',              'lightning-bolt-circle',  'streak_days',       30)
on conflict do nothing;
