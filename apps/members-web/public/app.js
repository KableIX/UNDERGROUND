// Renders plain text only (textContent). Never inject member data as HTML.
fetch("/api/dev/members")
  .then((r) => r.json())
  .then((data) => {
    const list = document.getElementById("members");
    for (const m of data.members) {
      const li = document.createElement("li");
      li.textContent = `${m.displayName} (${m.garage.length} cars)`;
      list.appendChild(li);
    }
  });