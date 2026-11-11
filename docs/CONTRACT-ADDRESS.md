# PAYPER contract address — how to add, change or remove it yourself

Right now there is **no PAYPER token**, so the setting is empty and the site shows:

> **PAYPER token · NOT LAUNCHED YET** — No PAYPER token or contract address exists yet. An address that claims to be PAYPER right now is not from this project.

There is no copy button and no pump.fun link while it is empty.

When the token really exists, you paste its **contract address** (also called the *mint* address or *CA*) into **one setting**. After a restart or redeploy, the site shows the address with a **Copy address** button and a **View on pump.fun ↗** link (`https://pump.fun/coin/<address>`).

There are two places you can put it. **If both are filled in, the host setting `TOKEN_MINT` wins.**

| Where the site runs | Setting name | Where you change it | How it takes effect |
|---|---|---|---|
| On a host (Render) | **`TOKEN_MINT`** | Render Dashboard → your service → **Environment** | **Save and deploy** (the site is offline for a short moment while it restarts) |
| On your own computer | **`contractAddress`** | the file `paper.config.json` | close the black window, double-click `START.bat` again |

The site does **not** pick up a change while it is running. There is no live reload: always restart (computer) or deploy (host).

There is deliberately **no web page, form, button or API** that can set the address. Only someone who can log in to your hosting account, or edit the file on your computer, can change it. The address is public information: it is **not** a password, key or secret, and nothing here ever asks for a private key or seed phrase.

---

## A. On Render (the public website)

1. Get the address from the token's own pump.fun page or from your own launch confirmation. It looks like 32–44 letters and digits, for example `7xKX…` (that is not a real address). Copy **only the address**, not the web link.
2. Log in at **https://dashboard.render.com** and click your **payper** service.
3. In the left menu click **Environment**.
4. Click **+ Add Environment Variable** (or **Edit** if `TOKEN_MINT` is already there).
   - **Key:** `TOKEN_MINT` (capital letters, exactly like that)
   - **Value:** paste the address, nothing else (no quotes, no spaces, no `https://`)
5. Click **Save, rebuild, and deploy** or **Save and deploy**. Either works because this app has nothing to build. Do **not** choose *Save only*: that stores the value but the running site keeps showing the old state until the next deploy.
6. Wait until the deploy shows **Live** (open **Events** or **Logs**). The log line `Token contract address: <address> (from TOKEN_MINT, format checked only)` confirms it.
7. Open the site and check that the address on the page matches your address **character by character**.

**If the deploy fails:** the address did not pass the format check. The **Logs** tab says why (see *Error messages* below). Because the service has a persistent disk, Render stops the old version before starting the new one, so **the site stays offline until a deploy with a valid value succeeds**. Fix the value (or delete `TOKEN_MINT`) and click **Save and deploy** again. To avoid this, test the exact address on your own computer first (part B): if START.bat accepts it, Render will too.

**To remove or change it:** edit or delete `TOKEN_MINT` the same way, then **Save and deploy**. With no value (and an empty `contractAddress`), the site goes back to **NOT LAUNCHED YET**.

## B. On your own computer (START.bat)

1. Close the black Payper window if it is open.
2. Open `paper.config.json` in Notepad. Near the top you will see:
   ```json
   "contractAddress": "",
   ```
3. Paste the address **between the two quotes**:
   ```json
   "contractAddress": "PASTE_THE_ADDRESS_HERE",
   ```
   Keep the quotes and the comma at the end of the line.
4. Save the file and double-click `START.bat`. The black window prints `Token contract address: … (from paper.config.json, format checked only)`.
5. To remove it, put it back to `""` and restart.

If the window says `contractAddress in paper.config.json: …` and does not start, fix the value as described below.

---

## Error messages and what they mean

The app checks the format when it starts. If the value is wrong, **it does not start**: it never shows a half-broken address.

| Message | What to do |
|---|---|
| *Paste only the mint address, not a web link…* | You pasted a link like `https://pump.fun/coin/…`. Keep only the part after the last `/`. |
| *must not contain spaces or line breaks* | Remove the extra text or spaces. Paste one address only. |
| *must be 32 to 44 characters long (got N)* | Part of the address is missing, or something extra was copied. Copy it again. |
| *may only contain Solana base58 letters and digits…* | Solana addresses never contain `0`, `O`, `I` or `l`, quotes or symbols. Re-copy it rather than typing it. |
| *does not decode to 32 bytes* | It looks like an address but is not a valid Solana key, usually a copy mistake. Copy it again. |
| *Unknown setting …* | A typo in the setting name in `paper.config.json`. It must be exactly `contractAddress`. |

## Important: a format check is not a guarantee

The check only proves the text **is shaped like a Solana address** (base58 that decodes to 32 bytes). It does **not** check that the token exists, who created it, or that it is the real PAYPER token. Anyone can create a token named PAYPER. That is why the site never searches for the token by name; it shows only the address you set. Always compare the address with your own launch record.

The site also says, and it stays true after launch: owning a PAYPER token is **not promised** to give earnings, fees or a share of anything, and Payper itself remains **paper trading with virtual money**. Real trading is not implemented.
