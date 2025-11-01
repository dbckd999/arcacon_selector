// 검색에 필요한 기능
async function search(term) {
  results = await db.emoticon.where('tags').equalsIgnoreCase(term).toArray();
  console.log(results);
}

document.getElementById('conSearch').addEventListener('input', async (e) => {
  const term = e.target.value;
  search(term);
});
