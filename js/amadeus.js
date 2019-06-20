var canvas = $("<canvas></canvas>").css({
    "position": "fixed",
    "z-index": "1",
    "top": "0",
    "left": "0"
});
canvas.attr("id", "bg");
$("body").append(canvas);

Matter.use('matter-collision-events');

let domMap = new Map();
let textStatic = true
let mouseInteractive = false
let interactives = null

function setupAmadeus() {
    return {
        // customizable options (passed into init function)
        options: {
            canvasSelector: '',				// to find <canvas> in DOM to draw on
            airFriction: 0.03,				// air friction of bodies
            opacity: 0,					// opacity of bodies
            collisions: true,				// do bodies collide or pass through
            scrollVelocity: 0.025,			// scaling of scroll delta to velocity applied to bodies
            pixelsPerBody: 50000,			// viewport pixels required for each body added

            colors: ['#e4e4cc', '#e1d2c4', '#d1e4df']
        },

        // throttling intervals (in ms)
        scrollDelay: 10,
        resizeDelay: 400,

        // throttling variables and timeouts
        lastOffset: undefined,
        scrollTimeout: undefined,
        resizeTimeout: undefined,

        // Matter.js objects
        engine: undefined,
        render: undefined,
        runner: undefined,
        bodies: undefined,
        mouse: undefined,

        // kicks things off
        init(options) {
            // override default options with incoming options
            this.options = Object.assign({}, this.options, options);

            let viewportWidth = document.documentElement.clientWidth;
            let viewportHeight = document.documentElement.clientHeight;

            this.lastOffset = window.pageYOffset;
            this.scrollTimeout = null;
            this.resizeTimeout = null;

            // engine
            this.engine = Matter.Engine.create();
            this.engine.world.gravity.y = 0;

            // render
            this.render = Matter.Render.create({
                canvas: document.querySelector(this.options.canvasSelector),
                engine: this.engine,
                options: {
                    width: viewportWidth,
                    height: viewportHeight,
                    wireframes: false,
                    background: 'transparent'
                }
            });
            Matter.Render.run(this.render);

            // runner
            this.runner = Matter.Runner.create();
            Matter.Runner.run(this.runner, this.engine);

            // bodies
            this.bodies = [];
            let interactives = $(".amadeus-interactive,.btn,img,p,h1,h2,h3,h4,h5");
            for (let i = 0; i < interactives.length; i++) {
                let body = this.createBody(interactives[i]);
                this.bodies.push(body);
                if (body.isStatic == false)
                    body.onCollide((e) => {
                        this.replaceHTMLObject((e.bodyA.isStatic == false) ? e.bodyA : e.bodyB);
                    });
                domMap.set(body, interactives[i]);
            }
            Matter.World.add(this.engine.world, this.bodies);

            if (mouseInteractive) {
                // add mouse control
                this.mouse = Matter.Mouse.create(this.render.canvas),
                    mouseConstraint = Matter.MouseConstraint.create(this.engine, {
                        mouse: this.mouse,
                        constraint: {
                            stiffness: 0.2,
                            render: {
                                visible: false
                            }
                        }
                    });

                Matter.World.add(this.engine.world, mouseConstraint);

                Matter.Events.on(mouseConstraint, "startdrag", (e) => this.replaceHTMLObject(e.body));

                this.mouse.element.removeEventListener("mousewheel", this.mouse.mousewheel);
                this.mouse.element.removeEventListener("DOMMouseScroll", this.mouse.mousewheel);

                // keep the mouse in sync with rendering
                this.render.mouse = this.mouse;
            }

            // events
            window.addEventListener('scroll', this.onScrollThrottled.bind(this));
            window.addEventListener('resize', this.onResizeThrottled.bind(this));
        },

        // stop all the things
        shutdown() {
            Matter.Engine.clear(this.engine);
            Matter.Render.stop(this.render);
            Matter.Runner.stop(this.runner);

            window.removeEventListener('scroll', this.onScrollThrottled);
            window.removeEventListener('resize', this.onResizeThrottled);
        },

        // random number generator
        randomize(range) {
            let [min, max] = range;
            return Math.random() * (max - min) + min;
        },

        // create body with some random parameters
        createBody(parameters) {
            let bounds = parameters.getBoundingClientRect()
            let width = (bounds.right - bounds.left)
            let height = (bounds.bottom - bounds.top)
            let collide = this.options.collisions ? 1 : -1
            let static = false
            let color = this.options.colors[this.bodies.length % this.options.colors.length]

            if (['p', 'h1', 'h2', 'h3', 'h4', 'h5'].some(function (str) { return (str.toUpperCase() == parameters.nodeName) })) {
                static = textStatic
                collide = (textStatic) ? -1 : 1
            } else {
                if ((width / document.documentElement.clientWidth) > .5) {
                    height = 5
                    static = true
                    collide = -1
                }
            }

            let x = bounds.left + (width / 2)
            let y = bounds.top + (height / 2)
            return Matter.Bodies.rectangle(x, y, width, height, {
                render: {
                    fillStyle: color,
                    opacity: this.options.opacity
                },
                frictionAir: this.options.airFriction,
                isStatic: static,
                collisionFilter: {
                    group: collide
                }
            });
        },

        replaceHTMLObject(body) {
            let htmlObj = domMap.get(body)
            if (body.fillStyle != "#ffffff" && body.isStatic == false) {
                domtoimage.toPng(htmlObj)
                    .then(function (dataUrl) {
                        body.render.sprite.texture = dataUrl
                        body.render.opacity = 1
                        body.fillStyle = "#ffffff"
                        htmlObj.style.visibility = "hidden"
                    })
                    .catch(function (error) {
                        console.error('oops, something went wrong!', error);
                    });
            }
        },

        // enforces throttling of scroll handler
        onScrollThrottled() {
            if (!this.scrollTimeout) {
                this.scrollTimeout = setTimeout(this.onScroll.bind(this), this.scrollDelay);
            }
        },

        // applies velocity to bodies based on scrolling with some randomness
        onScroll() {
            this.scrollTimeout = null;

            let delta = this.lastOffset - window.pageYOffset
            this.bodies.forEach((body) => {
                Matter.Body.setPosition(body, {
                    x: body.position.x,
                    y: body.position.y + delta
                });
            });

            this.lastOffset = window.pageYOffset;
        },

        // enforces throttling of resize handler
        onResizeThrottled() {
            if (!this.resizeTimeout) {
                this.resizeTimeout = setTimeout(this.onResize.bind(this), this.resizeDelay);
            }
        },

        // restart everything with the new viewport size
        onResize() {
            this.shutdown();
            this.init();
        }
    };
}


function startGravity() {
    textStatic = false
    mouseInteractive = true
    interactives = setupAmadeus()
    Object.create(interactives).init({
        canvasSelector: '#bg'
    });
}
