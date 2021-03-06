# Installation
1. Install npm. 
2. Install Mongodb
3. Install node modules by runnining the following 
```
npm install
mkdir data
```

# Running the local server

```
mongod --dbpath ./data
npm start
```

OR

Run the start-up script 
```
./start.sh
```

# livewriting

Live Writing, a web-based writing platform where keystrokes are recorded with timestamps and the writing can be reproduced as if it is typed in real-time. The core idea of live writing is to reveal the intermediate dynamical process of writing and to incorporate temporal change as part of expression in writing.

Demo is available at http://www.echobin.com/?aid=aboutechobin

Please contact sangwonlee@vt.edu for more detail.

# history


0.2.0 (Feb. 22 2016)
* Ace editor extended.
* Time Navigation Bar (for ace editor) is added.

0.1.0 (Sep. 16 2015)
* Textarea Ctrl/Cmd key fixed
* Safari Keystroke difference handled. (when command key is pressed)
* Codemirror as a main editor (instead of textarea)


0.0.3 (Feb. 26 2015)
* Special characters supported
* Carrige return problem resolved
* keypress / keyup / keydown differentiated
* keycode to charcode on keypress

0.0.2 (Jan. 16 2015)
* Arrow, selection backspace handled.
* Cut, Copy, Paste supported.
* Playback speed added
* drag and drop insdie textarea support
* scroll added

0.0.1 initial commit

# livewriting server firewall
node.js was not working and that iptables solved it.

```
iptables -I INPUT -p tcp --dport 8080 -j ACCEPT
iptables -I INPUT -p tcp --dport 80 -j ACCEPT
iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 80 -j REDIRECT --to-port 8080 
```

https://serverfault.com/questions/163111/allow-traffic-to-from-specific-ip-with-iptables

for https: 

```
iptables -I INPUT -p tcp --dport 443 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -s 0.0.0.0 -j ACCEPT
```
```
netstat -tulpn 
```

--> routing 80 request to a specific port (8080) in this case. 


Also you have to listen from all ips (0.0.0.0)
