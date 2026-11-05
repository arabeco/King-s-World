// Older gameplay journeys dismiss the newly added introductions through their
// visible close button. The dedicated visual test exercises all introductions.
export async function dismissSupplementaryGuides(page){
 await page.addLocatorHandler(page.getByRole('dialog',{name:/^Como (explorar o mundo|comandar seu reino|navegar pelas cidades|usar o tesouro|acompanhar suas ordens|acompanhar os relatos|acompanhar sua influência)$/}),async dialog=>{
  await dialog.getByRole('button',{name:'Fechar ajuda',exact:true}).click();
 });
}
