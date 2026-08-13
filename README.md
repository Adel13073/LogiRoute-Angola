# LogiRoute Angola

Sistema de otimização de rotas para logística urbana, desenvolvido para o contexto angolano.

## Sobre o projeto

O LogiRoute Angola é uma ferramenta que ajuda a planear rotas de entrega de forma eficiente. O utilizador define uma base de operações, adiciona paragens de entrega e o sistema calcula a melhor ordem para percorrer todos os pontos, minimizando distância, tempo ou custo de combustível.

O projeto foi construído para ser funcional mesmo sem ligação à internet, utilizando um modo de estimativa offline.

## Demonstração

Pode ver o projeto em funcionamento neste endereço:  
[https://adel13073.github.io/LogiRoute-Angola](https://adel13073.github.io/LogiRoute-Angola)

## Funcionalidades principais

- Três modos de otimização: mais rápida, menor distância e mais económica
- Mapa interativo com Leaflet e OpenStreetMap
- Geocodificação automática de endereços usando Nominatim
- Cálculo de rotas com a API OSRM (com fallback offline)
- Adição e reordenação de paragens
- Estimativa de consumo de combustível e custo
- Exportação da rota em formato de texto

## Tecnologias utilizadas

- HTML5
- CSS3 (com variáveis e design responsivo)
- JavaScript (ES6+)
- Leaflet.js (mapas interativos)
- OpenStreetMap Nominatim (geocodificação)
- OSRM (cálculo de rotas)

## Estrutura do projeto
LogiRoute-Angola/
├── index.html 
├── css/
│ └── style.css 
├── js/
│ └── script.js


## Como usar

1. Abra o ficheiro `index.html` no navegador.
2. Defina a base de operações (endereço de partida).
3. Adicione paragens de entrega, escrevendo o endereço ou clicando nos bairros rápidos.
4. Selecione o modo de otimização pretendido.
5. Clique em "Calcular Rota Otimizada".
6. O mapa mostra a rota e a sidebar apresenta as estatísticas e a ordem das paragens.

## Modo offline

Se a ligação à internet falhar, o sistema entra em modo de estimativa e calcula a rota usando distâncias em linha reta, com base nas coordenadas aproximadas dos pontos. Isso permite que a ferramenta continue funcionando mesmo sem acesso à internet.

## Créditos

Este projeto foi desenvolvido por pela equipa de Devs da ELEVEN TECHNOLOY.

## Licença

Este projeto está sob a licença MIT.
