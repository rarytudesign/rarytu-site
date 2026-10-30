# rarytu: personal website

A static site: plain HTML, CSS and JavaScript. No build step, no framework, no database.
Everything the site needs is in this folder, including fonts, images, videos and both CVs.

```
index.html          sends visitors to /en/ or /ru/ depending on their browser language
en/  ru/            the pages: Work (index.html), about/, approach/, work/<project>/
assets/styles.css   all styles
assets/main.js      all interactions and animations
assets/img, video   images (.webp) and videos (.mp4)
assets/cv           CV PDFs (EN, RU)
```

To look at it on your computer: open Terminal in this folder and run
`python3 -m http.server 8000`, then go to http://localhost:8000.
(Opening index.html by double-click also works, apart from a few browser restrictions on video.)

---

## Going live with your own domain

You need two things that are bought and set up separately:

1. **A domain** (rarytu.com or similar): your address. Paid yearly.
2. **Hosting**: a server that serves this folder. For a static site like this one it can be free.

### Step 1. Buy the domain

Check it is free first, e.g. at reg.ru or any registrar's search.

- **Reg.ru** sells .com and takes Russian cards. In October 2026 it listed .com at about 1,629 ₽ for the first year and 2,349 ₽ to renew.
- International registrars (Porkbun, Namecheap, Cloudflare Registrar) are often cheaper but usually need a non-Russian card.

What to buy: the domain only. Skip hosting, website builders, "SEO packages" and paid email on that checkout page.
Do turn on: auto-renewal, and WHOIS privacy if it is offered for free.

### Step 2. Choose hosting

Things to know before choosing, as of autumn 2026:

- Since June 2025 Russian ISPs throttle Cloudflare: sites behind Cloudflare's proxy often load half-way for visitors in Russia. **Don't use Cloudflare Pages or the Cloudflare proxy for this site** if you want it to open well for Russian clients and friends.
- There are user reports of Vercel being unreliable from Russia at times.

Recommended options:

| Option | Cost | Good for |
|---|---|---|
| **GitHub Pages** | free | Simple, reliable, and easy for me to update: every change goes into a repository and the site redeploys itself. Hosted on Fastly abroad. |
| **Netlify** | free tier | Drag-and-drop the folder onto app.netlify.com/drop, then connect your domain. Also abroad. |
| **Russian hosting** (Timeweb, Beget, Yandex Cloud Object Storage) | about 100–300 ₽/month | Best if many visitors are in Russia. Upload this folder over the web panel or FTP. |

My suggestion: **GitHub Pages**. It's free, and it gives us one place where the site lives and where I can make edits. Before you send the link around, test it from a Russian mobile network and from abroad (a VPN works for that). If it is slow in Russia, move the same folder to Russian hosting. Nothing in the site needs to change.

### Step 3. Connect the domain

**Done 30.10.2026:** rarytu.com is live on GitHub Pages with HTTPS (DNS at Spaceweb, domain verified in GitHub). www.rarytu.com and the old rarytudesign.github.io/rarytu-site address redirect to it; rarytu.ru redirects to https://rarytu.com through Spaceweb «Переадресация». rarytu.ru still needs the Gosuslugi (ЕСИА) identification in Spaceweb before it can be renewed.

At the registrar, open the domain's **DNS settings** and add the records your host gives you.
For GitHub Pages they are:

```
Type   Name   Value
A      @      185.199.108.153
A      @      185.199.109.153
A      @      185.199.110.153
A      @      185.199.111.153
CNAME  www    rarytudesign.github.io
```

Then in the GitHub repository go to Settings → Pages → Custom domain, enter rarytu.com, and once the check passes tick **Enforce HTTPS**.
DNS changes take from a few minutes up to 24 hours.

### Step 4. Set it up so I can keep editing the site

1. Create a free account at github.com.
2. Create a new repository, e.g. `rarytu-site` (public, which free GitHub Pages needs).
3. In claude.ai: Settings → Connectors → GitHub, connect your account and give it access to that repository.
4. Tell me the repository name. I'll push this folder there, turn on Pages and add the domain file. From then on every edit you ask for goes straight to the live site.

---

## Панель управления

Адрес: **rarytu.com/admin/** (добавь в закладки; на сайте ссылки на неё нет).

**Вход по логину и паролю.**
- Один раз: открой панель на компьютере, где она уже работает, и нажми **Set up sign-in** вверху. Придумай логин и пароль (от 10 символов).
- Дальше на любом устройстве: логин и пароль. Галочка **Remember this device** запоминает устройство на 180 дней с последнего захода, вводить ничего не нужно. Без галочки вход живёт до закрытия вкладки.
- Выйти на устройстве: значок со стрелкой справа вверху.
- Сменить логин или пароль: Site backups → Sign-in and GitHub access.
- Забыла пароль: на экране входа **Forgot the password?** Войди в GitHub (его пароль восстанавливается по почте), сделай новый ключ (ниже), вставь его и задай новый логин и пароль. Работает на любом устройстве. Старый пароль после этого перестаёт работать.

Как это защищено: сервера у сайта нет, поэтому пароль защищает сам ключ GitHub. В репозитории лежит admin/auth.json: ключ, зашифрованный логином и паролем. Без них его не расшифровать, и без ключа панель ничего не может изменить.

**Ключ GitHub** нужен один раз при настройке и раз в год, когда он истекает (панель сама попросит новый и сохранит его для всех устройств).
Создаётся на github.com/settings/personal-access-tokens/new: Expiration 1 year, Only select repositories → rarytu-site, Permissions → Contents: Read and write.

**Как править**
1. Слева выбери страницу: Site (имя, контакты, CV, служебные надписи), Work, About, Approach или проект.
2. Меняй поля слева, справа сразу видно страницу. Над превью переключатели EN/RU и Mobile / Tablet / Desktop.
3. В каждом поле два языка. Галочка «Different text on mobile and tablet» даёт отдельный текст для мобильной версии.
4. Shift+Enter = новая строка; без неё текст переносится сам по ширине. В полях с абзацами Enter = новый абзац.
   Уже существующие переносы сохраняют своё поведение (на главной в заголовке они срабатывают только на телефонах, как в макете).
   Слова через дефис на русских страницах не разрываются сами.
5. Undo / Redo: стрелки рядом с «Anastasia Rarytu (Admin)» или Ctrl+Z / Ctrl+Shift+Z (Cmd на Mac). Отменяется и «Discard draft».
6. Картинки и видео загружаются кнопками рядом с полями. Картинки панель сама переводит в WebP нужных размеров. Видео: только MP4, лучше до 25 МБ.

**Черновик и публикация**
- Все правки сразу сохраняются черновиком в этом браузере (даже если закрыть вкладку). На сайте их ещё нет.
- Точка у вкладки слева = на этой странице есть неопубликованные правки.
- **Publish** отправляет всё разом. Сайт обновляется через 1–2 минуты. Каждая публикация становится новой версией в истории (Site backups).
- **Discard draft** выбрасывает черновик, сайт остаётся как есть.
- Если панель пишет, что страница изменилась на сайте после начала черновика, значит её в это время правил Claude. «Publish anyway» заменит его правку твоей.

**Копирайт**: в Site → Copyright line стоит «©{year}», год подставляется сам и меняется каждый январь.

**Контакты**: один список на весь сайт (футер всех страниц и круглые кнопки на Approach), до 10. На десктопе стоят в один ряд; если не помещаются по ширине, футер показывается списком, как на телефоне.

**Проекты**
- «+ New project»: название и адрес страницы, дальше обложка, тексты и галерея во вкладке проекта.
- Порядок проектов меняется стрелками во вкладке Work.
- Внизу вкладки проекта: скрыть с сайта (можно вернуть) или удалить.

**Бэкапы**: вкладка Site backups. Save backup сохраняет ZIP всего сайта на компьютер, Restore backup возвращает сайт к архиву.

## After launch

- Replace the CVs: keep the same file names in `assets/cv/` and the site picks them up.
- Search engines: once the site is live, add it to Google Search Console and Yandex Webmaster (free) and submit the home page.
- The temporary preview link on claude.ai keeps working, but the real address will be your domain.
