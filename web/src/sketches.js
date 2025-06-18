
bpm = 120;
a.setSmooth(0.99)

osc(10, 0.08, 0.8)
.color(1*2, 0.8*4, 0.9)
.modulate(noise(4, 0.1).rotate(0.01, 0.02).scale(1.1),0.1)
.modulate(src(o0).scale(1.1).rotate(0.01), 0.2)
.invert()
.saturate(1.1)
.out()


osc([5, 7, 5].smooth().fast(0.05), 0.1, 0.8)
.color(0.8*4, 2, 0.9)
.modulate(noise(1, 0.1).rotate(0.1, 0.02).scale(1.1),0.1)
.modulate(src(o0).scale(1.1).rotate(0.01), 0.1)
.invert()
.saturate(1.1)
.out()

osc(15, 0.1, 0.8)
.color(0.8*4, 0.9*2, 2)
.modulate(noise(3, 0.1).rotate(0.1, 0.02).scale(1.1),0.1)
.modulate(src(o0).scale(1.1).rotate(0.01), 0.1)
//.invert()
.saturate(1.1)
.out()

osc(15, 0.1, 0.8)
.color(0.8*4, 0.9*2, 2)
.modulate(noise(3, 0.1).rotate(0.1, 0.02).scale(1.1),0.1)
.modulate(src(o0).scale(1.1).rotate(0.01), 0.1)
.invert()
.saturate(1.1)
.out()


  osc(10, 0.1, 0.6)
  .color(0.9, 1*2, 0.8*4)
  .modulate(noise(3, 0.1).rotate(0.01, 0.02).scale(4),0.5)
  .modulate(src(o0).scale(1.1).rotate(0.1), 0.2)
  //.invert()
  .saturate(1.1)
  .out()

  // rojo morado y amarillo 
  osc(10, 0.1, 0.6)
  .color(0.9, 1*2, 0.8*4)
  .modulate(noise(3, 0.1).rotate(0.01, 0.02).scale(4),0.5)
  .modulate(src(o0).scale(1.1).rotate(0.1), 0.2)
  .invert()
  .saturate(1.1)
  .out()


  /////////////////////////////////////////77

  osc(19, 0.1, 0.4)
  .color(0.8*8, 0.9*4, 1)
  .modulate(noise(3, 0.1).rotate(0.1, 0.02).scale(1.1),0.1)
  .modulate(src(o0).scale(1.1).rotate(0.01), 0.1)
  .invert()
  .saturate(1.1)
  .out()

  osc(19, 0.4, 0.4)
  .color( 1.5, 0.9*8,0.8*4)
  .modulate(noise(1, 0.1).rotate(0.1, 0.02).scale(1.01),0.5)
  .modulate(src(o0).scale(1.1).rotate(0.01), 0.1)
  .invert()
  .saturate(1.1)
  .out()


  osc(12, 0.4, 0.4)
  .color(1, 0.8*8, 0.9*4)
  .modulate(noise(1, 0.1).rotate(0.1, 0.02).scale(1.01),0.5)
  .modulate(src(o0).scale(1.1).rotate(0.01), 0.1)
  .invert()
  .saturate(1.1)
  .out()


  osc(10, 0.14, 0.4)
  .color( 2, 0.9*8,0.8*4)
  .modulate(voronoi(0.8, 0.1).rotate(0.01, 0.02).scale(1.01),0.3)
  .modulate(src(o0).scale(1.1).rotate(0.1), 0.2)
  //.invert()
  .saturate(1.1)
  .out()
