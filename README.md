# 🏆 Bolão Copa 2026
### Desenvolvido por Jhony Beraldo

Site de acompanhamento do bolão da Copa 2026. Totalmente gratuito, sem backend, sem banco de dados — funciona 100% no navegador via GitHub Pages.

---

## 🚀 Como publicar no GitHub (grátis)

### Passo 1 — Criar repositório
1. Acesse [github.com](https://github.com) e faça login (ou crie uma conta gratuita)
2. Clique em **New repository**
3. Nome: `bolao-copa2026` (ou qualquer nome)
4. Deixe **Public**
5. Clique **Create repository**

### Passo 2 — Subir os arquivos
1. Na página do repositório, clique **uploading an existing file**
2. Arraste os 4 arquivos: `index.html`, `style.css`, `app.js`, `data.js`
3. Clique **Commit changes**

### Passo 3 — Ativar GitHub Pages
1. Vá em **Settings** → **Pages**
2. Em **Source**, selecione **Deploy from a branch**
3. Branch: `main` / Pasta: `/ (root)`
4. Clique **Save**
5. Aguarde ~2 minutos e o site estará disponível em:
   `https://SEU-USUARIO.github.io/bolao-copa2026`

---

## 🔒 Senha padrão do Admin
**`bolao2026`**

> Para trocar a senha, abra o arquivo `app.js` e edite a linha:
> ```js
> const ADMIN_PASS = "bolao2026";
> ```

---

## 📋 Como usar

### Área Pública
- **Ranking** — Classificação geral com pódio e detalhes por participante
- **Jogos** — Calendário completo com resultados
- **Palpites** — Palpites de todos por jogo
- **Estatísticas** — Rankings de exatos, vencedores e gráfico de barras

### Área Admin (`/admin`)
1. **Importar Jogos** — Clique em "Importar Jogos Copa 2026" (já cadastra os 40 jogos da imagem)
2. **Participantes** — Cadastre os participantes
3. **Palpites** — Insira os palpites de cada participante por jogo
4. **Resultados** — Após cada jogo, insira o resultado e o ranking recalcula automaticamente

---

## 💾 Armazenamento
Os dados ficam salvos no `localStorage` do navegador. Para usar em computadores diferentes, recomenda-se usar sempre o mesmo dispositivo como "admin". Se precisar de múltiplos dispositivos, considere migrar para Supabase (pode ser feito futuramente).

---

## 🏆 Sistema de Pontuação
| Situação | Pontos |
|---|---|
| Placar exato | 7 pts |
| Empate exato | 7 pts |
| Empate (placar diferente) | 3 pts |
| Vencedor + gols do vencedor | 5 pts |
| Vencedor + gols do perdedor | 4 pts |
| Apenas vencedor | 3 pts |
| Placar invertido exato | 1 pt |
| Errou tudo | 0 pts |

---

*Desenvolvido por Jhony Beraldo*
