const params = new URLSearchParams(location.search);
const id = params.get("id");

const response = await fetch(
  `https://example.supabase.co/rest/v1/games?id=eq.${id}`,
  {
    headers: {
      apikey: "PUBLIC_ANON_KEY"
    }
  }
);

const [game] = await response.json();

document.querySelector("h1").textContent = game.title;
