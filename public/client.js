const socket = io();

const messages = document.getElementById('messages');
const form = document.getElementById('form');
const input = document.getElementById('input');
const countEle = document.getElementById('count')
const count_txt = document.getElementById('count_txt')
const name = prompt("Enter your name")

function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(showPosition);
  } else {
    console.log("no");
  }
}

function showPosition(position) {
  console.log('Latitude:', position.coords.latitude);
  console.log('Longitude:', position.coords.longitude);
  socket.emit('location', { latitude: position.coords.latitude, longitude: position.coords.longitude, user: name })
}

// this is causing the roomId to not appear on server side
getLocation()

form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (input.value) {
        socket.emit('chat message', { msg: input.value, name: name, room: roomId });
        input.value = '';
    }
});

let roomId = '';
socket.on('room', (room) => {
  console.log(room);
  roomId = room
    // console.log('called new user here');
})
// socket.emit('new user', { name: name, room: roomId })

socket.on('new user', user => {
    console.log(user);
    const userEle = document.createElement('h3')
    userEle.innerHTML = `${user.name} has joined the chat`
    userEle.style.textAlign = 'center';
    messages.appendChild(userEle)
})

socket.on('count',(count)=>{
    // console.log('users count');
    console.log(count);
    count_txt.innerText = count
})

socket.on('chat message', (msg) => {
    console.log(msg);
    const item = document.createElement('li');
    item.innerHTML = `${msg.name}<br>${msg.msg}`;
    const msgDiv = document.createElement('div')
    messages.appendChild(item);
    window.scrollTo(0, document.body.scrollHeight);
});

socket.on('user left',(user)=>{
    console.log(`${user} has left`);
    const userEle = document.createElement('h3')
    userEle.innerHTML = `${user} has left the chat`
    userEle.style.textAlign = 'center';
    userEle.style.color = 'red'
    messages.appendChild(userEle)
});