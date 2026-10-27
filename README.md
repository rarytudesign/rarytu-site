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

At the registrar, open the domain's **DNS settings** and add the records your host gives you.
For GitHub Pages they are:

```
Type   Name   Value
A      @      185.199.108.153
A      @      185.199.109.153
A      @      185.199.110.153
A      @      185.199.111.153
CNAME  www    <your-github-username>.github.io
```

Then in the GitHub repository go to Settings → Pages → Custom domain, enter rarytu.com, and once the check passes tick **Enforce HTTPS**.
DNS changes take from a few minutes up to 24 hours.

### Step 4. Set it up so I can keep editing the site

1. Create a free account at github.com.
2. Create a new repository, e.g. `rarytu-site` (public, which free GitHub Pages needs).
3. In claude.ai: Settings → Connectors → GitHub, connect your account and give it access to that repository.
4. Tell me the repository name. I'll push this folder there, turn on Pages and add the domain file. From then on every edit you ask for goes straight to the live site.

---

## After launch

- Replace the CVs: keep the same file names in `assets/cv/` and the site picks them up.
- Search engines: once the site is live, add it to Google Search Console and Yandex Webmaster (free) and submit the home page.
- The temporary preview link on claude.ai keeps working, but the real address will be your domain.
