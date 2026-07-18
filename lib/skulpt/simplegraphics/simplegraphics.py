from time import sleep
import time

try:
  import tkinter as tk
except:
  exit("SimpleGraphics failed to import the required Tk Interface library.")

__master = None
__canvas = None

__image_references = set()

__closePressed = False

__mouseX = 0
__mouseY = 0
__b1down = False
__b1_clear_after_id = None
__mouseEvents = []

__typed = ""
__keys = set()
__heldKeys = set()
__held_key_clear_ids = {}
__last_keydown_ts = {}

__outline = "black"
__fill = "white"
__width = 1

__arrowshape = "8 10 3"
__autoupdate = True
__font = None
__font_size = 24
__font_modifiers = ""
__font_count = 0

__background = None
__bgcolor = "#d0d0d0"
__bgcolor = "#d0d0d0"
__loop = False
__frmTime = 50
__animation = None
__after_id = None

def __init():
  global __canvas
  global __master
  global __background

  __master = tk.Tk()
  __wx = __master.winfo_screenwidth()
  __wy = __master.winfo_screenheight()
  __mw = 810
  __mh = 670
  if __wx < 810:
      __mw = __wx-20
  if __wy < 670:
      __mh = __wy    
  __master.geometry(f"{__mw}x{__mh}")
  __master.title("SimpleGraphics")

  # Without this, clicking the window's "X" button destroys the Tk window
  # but the library never finds out: __closePressed stays False and any
  # running doAnimate() loop keeps trying to schedule/draw against a
  # window that no longer exists (which is also what causes the old
  # animation to appear to "keep going" the next time a script runs in
  # the same process/session).
  # Some Tk shims (e.g. Skulpt's browser implementation) don't implement
  # .protocol() at all, so this is skipped silently rather than crashing
  # __init() and breaking the library entirely on those platforms.
  try:
    __master.protocol("WM_DELETE_WINDOW", __onWindowClose)
  except AttributeError:
    pass

  __canvas = tk.Canvas(__master, width=__mw-10, height=__mh-70)
  __canvas.pack()

  # Skulpt's browser tkinter shim has no winfo_pointerxy(): the browser
  # doesn't let JS poll "where is the mouse right now" outside of an
  # event, it only reports mouse position inside mouse events. So instead
  # of polling, we track the position continuously via <Motion> and
  # mousePos() just returns whatever was last recorded.
  try:
    __canvas.bind("<Motion>", __onMouseMove)
  except AttributeError:
    pass

  # Mouse button tracking.
  #
  # The Skulpt tkinter shim collapses "<Button-1>", "<Button-2>" and
  # "<Button-3>" all down to the same internal "<Button>" handler slot
  # (it strips everything after the "-"), and only wires up mousedown -
  # never mouseup/ButtonRelease. It also never reports which physical
  # button was pressed (no event.num). So in the browser we can only
  # reliably detect "some button was pressed just now", not which one,
  # and not when it was released.
  #
  # We bind a single mousedown handler and treat it as the (primary/left)
  # button. To approximate a "currently held" state despite there being
  # no release event, we also use <B1Motion> - which the shim only fires
  # while a button is actually down during a drag - and let that state
  # auto-expire a fraction of a second after the last drag tick. This
  # correctly tracks a held-and-dragged button; a button held perfectly
  # still (no movement) can't be detected in this shim, since nothing in
  # it reports button-up or button-down-without-movement.
  try:
    __canvas.bind("<Button-1>", __onButtonPress)
  except AttributeError:
    pass

  try:
    __canvas.bind("<B1Motion>", __onDrag)
  except AttributeError:
    pass

  # Keyboard tracking.
  #
  # This shim's key handler only reacts to native "keydown" events - it
  # never looks at "keyup" at all, so <KeyRelease> (and therefore also
  # <FocusOut>, which we'd use to clear held keys on blur) never fires.
  # To still offer a usable getHeldKeys(), we lean on the browser's own
  # keyboard auto-repeat: a physically-held key keeps sending repeated
  # keydown events, so we treat "no repeat keydown for a short while" as
  # "the key was released" and expire it then.
  try:
    __master.bind("<Key>", __onKeyPress)
  except AttributeError:
    pass

  # Give the window keyboard focus right away so that key presses are
  # picked up without the user having to click into the canvas first.
  # Focus has to land on the canvas itself (the actual focusable DOM
  # element) rather than on the abstract root window - some tkinter
  # shims (e.g. Skulpt's) only implement focus_set() on widgets that
  # correspond to a real focusable element, which the root window isn't.
  try:
    __canvas.focus_set()
  except AttributeError:
    pass

  setFont("Arial")

  __background = __canvas.create_rectangle(0, 0, getWidth()+1, getHeight()+1, fill=__bgcolor, outline=__bgcolor, tag="__background")

  update()

def __onMouseMove(event):
  global __mouseX
  global __mouseY

  __mouseX = event.x
  __mouseY = event.y

def __onButtonPress(event):
  __mouseEvents.append(("<Button-1>", mousePos()))
  __markButtonDown()

def __onDrag(event):
  __markButtonDown()

def __markButtonDown():
  global __b1down, __b1_clear_after_id

  __b1down = True

  if __b1_clear_after_id is not None:
    try:
      __master.after_cancel(__b1_clear_after_id)
    except Exception:
      pass

  # There's no mouseup in this shim, so we can't be told when the button
  # actually goes up. Instead, assume it's still down as long as drag
  # ticks (<B1Motion>) keep arriving, and consider it released once they
  # stop for a moment. 120ms is comfortably longer than the gap between
  # consecutive mousemove events during an active drag, but short enough
  # that release feels close to immediate once the user stops.
  try:
    __b1_clear_after_id = __master.after(120, __clearButtonDown)
  except AttributeError:
    pass

def __clearButtonDown():
  global __b1down, __b1_clear_after_id
  __b1down = False
  __b1_clear_after_id = None

def __onKeyPress(event):
  global __typed, __last_keydown_ts

  try:
    keysym = event.keysym
  except AttributeError:
    keysym = ""

  # Debounce: some environments end up delivering the same physical
  # keydown to this handler more than once (e.g. duplicate wiring
  # somewhere between the browser and this shim). Real OS/browser key
  # auto-repeat is much slower than this (typically 30ms+ between
  # repeats, with a 500ms+ initial delay), so treat anything arriving
  # under 25ms after the previous event for the *same* key as a
  # duplicate delivery of the same press, not a genuine repeat.
  now = time.time()
  dedupe_key = keysym if keysym else "__nokeysym__"
  last_ts = __last_keydown_ts.get(dedupe_key)
  if last_ts is not None and (now - last_ts) < 0.025:
    return
  __last_keydown_ts[dedupe_key] = now

  try:
    ch = event.char
  except AttributeError:
    ch = ""

  if ch:
    # Backspace
    if len(ch) == 1 and ord(ch) == 8:
      if len(__typed) > 0:
        __typed = __typed[:-1]
    elif len(__typed) < 1024:
      __typed = __typed + ch
    else:
      __typed = __typed[1:] + ch

  if keysym:
    __keys.add(keysym)
    __heldKeys.add(keysym)
    __markKeyDown(keysym)

def __markKeyDown(keysym):
  global __held_key_clear_ids

  pending_id = __held_key_clear_ids.get(keysym)
  if pending_id is not None:
    try:
      __master.after_cancel(pending_id)
    except Exception:
      pass

  # This shim never fires a genuine key-up event, so we can't be told
  # when a key is actually released either. Browsers auto-repeat keydown
  # while a key is physically held, so treat "no repeat keydown for a
  # while" as "released". 700ms comfortably covers a typical browser's
  # initial repeat delay (often ~500-600ms before repeating starts) so a
  # held key doesn't flicker out of getHeldKeys() right after the first
  # press, at the cost of release being detected a bit late.
  try:
    __held_key_clear_ids[keysym] = __master.after(
        700, lambda k=keysym: __clearHeldKey(k))
  except AttributeError:
    pass

def __clearHeldKey(keysym):
  __heldKeys.discard(keysym)
  __held_key_clear_ids.pop(keysym, None)

def __onWindowClose(event=None):
  global __closePressed

  __closePressed = True
  noAnimate()
  try:
    __master.destroy()
  except Exception:
    pass

def doAnimate(func):
    global __loop, __animation, __after_id
    if not __loop:
        __animation = func
        __loop = True

    __animation()

    # Only schedule the next frame if the animation hasn't been stopped
    # (e.g. by a call to noAnimate() from inside __animation() itself).
    if __loop:
        __after_id = __master.after(__frmTime, lambda : doAnimate(func))
    else:
        __after_id = None

def noAnimate():
    global __loop, __after_id
    __loop = False
    # Read defensively: on some platforms (e.g. certain browser-based Python
    # runtimes) noAnimate() can end up being called before this module's
    # top-level "__after_id = None" has taken effect in the scope __after_id
    # is resolved against, which would otherwise raise a NameError here.
    try:
        __pending_after_id = __after_id
    except NameError:
        __pending_after_id = None

    # Cancel any already-scheduled frame so it doesn't fire later and
    # accidentally restart the loop (this also matters when noAnimate()
    # is called from outside the animation function, e.g. from a button).
    if __pending_after_id is not None:
        try:
            __master.after_cancel(__pending_after_id)
        except Exception:
            pass
        __after_id = None

def isAnimate():
    return __loop

def animationTime(frm_time=None):
    global __frmTime
    if frm_time is not None:
        if frm_time > 0: 
            __frmTime = frm_time            
        else:    
            __frmTime = 0
            noAnimate()
    else:
        return __frmTime      

def close():
  global __closePressed
  global __canvas
  global __master

  __closePressed = True
  try:
    __canvas = None
    __master.destroy()
    __master = None
  except:
    pass;

def setWindowTitle(t):
  global __master
  __master.title(t)

def __update():
    pass

def update():
    pass

def closed():
  try:
    __master.update()
    return __closePressed
  except:
    return True

def mousePos():
  return (__mouseX, __mouseY)

def mouseX():
  return mousePos()[0]

def mouseY():
  return mousePos()[1]

## Return True if and only if a mouse button appears to be currently held
#  down over the canvas.
#
#  Known limitation of the browser build: the underlying Skulpt tkinter
#  shim never reports which physical button was pressed, and never fires
#  a button-up event at all, so this can only detect "some button is
#  down and the mouse is being dragged" - it can't tell left from right
#  from middle, and it can't detect a button held perfectly still.
def leftButtonPressed():
  return __b1down

## Always returns False in the browser build: the underlying Skulpt
#  tkinter shim has no way to tell which mouse button was pressed, so
#  the middle and right buttons can never be distinguished from the
#  left one here. Use leftButtonPressed() or getMouseEvent() instead.
def middleButtonPressed():
  return False

## Always returns False in the browser build: the underlying Skulpt
#  tkinter shim has no way to tell which mouse button was pressed, so
#  the middle and right buttons can never be distinguished from the
#  left one here. Use leftButtonPressed() or getMouseEvent() instead.
def rightButtonPressed():
  return False

## Retrieve and remove the oldest recorded mouse click event
#  @return a tuple of ("<Button-1>", (x, y)) or None if there are no
#          pending mouse events. Every click is reported as "<Button-1>"
#          regardless of which physical button was actually pressed,
#          since the browser doesn't tell us - see leftButtonPressed().
def getMouseEvent():
  if len(__mouseEvents) == 0:
    return None
  return __mouseEvents.pop(0)

## Retrieve the oldest recorded mouse click event without removing it
#  @return a tuple of ("<Button-1>", (x, y)) or None if there are no
#          pending mouse events
def peekMouseEvent():
  if len(__mouseEvents) == 0:
    return None
  return __mouseEvents[0]

## Discard all pending mouse click events
def clearMouseEvents():
  __mouseEvents.clear()

## Return all of the input typed by the user, removing it from the input buffer
def getTyped():
  global __typed
  result = __typed
  __typed = ""
  return result

## Return any input typed by the user without removing it from the input buffer
def peekTyped():
  return __typed

## Return the characters typed by the user up to the first newline character.
#  Return an empty string if a newline has not yet been entered. Any
#  characters returned are removed from the input buffer.
def getTypedLine():
  global __typed
  result = ""

  crpos = __typed.find(chr(10))
  lfpos = __typed.find(chr(13))

  if crpos >= 0 or lfpos >= 0:
    result = __typed[:max(crpos, lfpos) + 1]
    __typed = __typed[max(crpos, lfpos) + 1:]

  return result

## Return the characters typed by the user up to the first newline character.
#  Return an empty string if a newline has not yet been entered. Any
#  characters returned remain in the input buffer.
def peekTypedLine():
  result = ""

  crpos = __typed.find(chr(10))
  lfpos = __typed.find(chr(13))

  if crpos >= 0 or lfpos >= 0:
    result = __typed[:max(crpos, lfpos) + 1]

  return result

## Return a set of all of the keys pressed since the last time getKeys was
#  called.
def getKeys():
  global __keys
  retval = __keys.copy()
  __keys.clear()
  return retval

## Return a set of all of the keys that are currently held down.
#  Note that if the window does not have focus then the set of keys returned
#  will be empty, even if there are keys being pressed.
def getHeldKeys():
  return __heldKeys.copy()

## Return a set of all of the keys pressed since the last time getKeys was
#  called. Does not clear the set of keys that have been pressed.
def peekKeys():
  return set(__keys)

def setOutline(r, g=None, b=None):
  global __outline
  if g == None and b == None:
    __outline = r
  elif g != None and b != None:
    __outline = "#%02x%02x%02x" % (int(r), int(g), int(b))
  else:
    raise TypeError("setOutline cannot be called with 2 arguments")

def setFill(r, g=None, b=None):
  global __fill
  if g == None and b == None:
    __fill = r
  elif g != None and b != None:
    __fill = "#%02x%02x%02x" % (int(r), int(g), int(b))
  else:
    raise TypeError("setFill cannot be called with 2 arguments")

def setWidth(w=1):
  global __width
  __width = w

def setCapStyle(s):
    pass

def setJoinStyle(s):
    pass

def setArrow(s):
    pass

def setArrowShape(a = 8, b = 10, c = 3):
  global __arrowshape
  __arrowshape = "%d %d %d" % (a, b, c)

def setColor(r, g=None, b=None):
  if g != None and b == None:
    raise TypeError("setColor cannot be called with 2 arguments")
  setFill(r, g, b)
  setOutline(r, g, b)

def background(r, g=None, b=None):
  global __bgcolor

  try:
    if g == None and b == None:
      bg = r
    elif g != None and b != None:
      bg = "#%02x%02x%02x" % (int(r), int(g), int(b))
    else:
      raise TypeError("background cannot be called with 2 arguments")
    __bgcolor = bg
    __canvas.itemconfig(__background,fill=bg)
    __update()

  except Exception as e:
    if __canvas == None:
      pass;
    else:
      raise e

  finally:
    pass;

def line(*pts):
  try:
    if len(pts) == 1:
      new_pts = list(pts[0])
    else:
      new_pts = list(pts)
    for i in range(len(new_pts)):
      new_pts[i] = new_pts[i] + 1
    shape = __canvas.create_line(new_pts, fill=__outline, width=__width)
    __update()
    return shape

  except Exception as e:
    if __canvas == None:
      pass;
    else:
      raise e

  finally:
    pass;

def curve(*pts):
  try:
    if len(pts) == 1:
      new_pts = pts[0]
    else:
      new_pts = list(pts)
    for i in range(len(new_pts)):
      new_pts[i] = new_pts[i] + 1

    shape = __canvas.create_line(new_pts, fill=__outline, width=__width, smooth=True, splinesteps=25)
    __update()
    return shape
  except Exception as e:
    if __canvas == None:
      pass;
    else:
      raise e

  finally:
    pass;

def blob(*pts):
  try:
    if len(pts) == 1:
      new_pts = pts[0]
    else:
      new_pts = list(pts)
    for i in range(len(new_pts)):
      new_pts[i] = new_pts[i] + 1

    shape = __canvas.create_polygon(new_pts, fill=__fill, outline=__outline, smooth=True, width=__width)
    __update()
    return shape

  except Exception as e:
    if __canvas == None:
      pass;
    else:
      raise e

  finally:
    pass;

def rect(x, y, w, h):
  w = round(w)
  h = round(h)
  try:
    if abs(w) >= 2 and abs(h) >= 2:
      __shape = __canvas.create_rectangle(x + 1, y + 1, x + 1 + w - 1, y + 1 + h - 1, fill=__fill, outline=__outline, width=__width)
      __update()
      return __shape
    elif abs(w) == 1 and abs(h) == 1:
      __shape = line(x, y, x + 1, y)
      __update()
    elif abs(w) == 1:
      __shape = line(x, y, x, y + h)
      __update()
    elif abs(h) == 1:
      __shape = line(x, y, x + w, y)
      __update()
    return __shape
  except Exception as e:
    if __canvas == None:
      pass;
    else:
      raise e

  finally:
    pass;

def ellipse(x, y, w, h):
  try:
    __shape = __canvas.create_oval(x + 1, y + 1, x+w, y+h, fill=__fill, outline=__outline, width=__width)
    __update()
    return __shape
  except Exception as e:
    if __canvas == None:
      pass;
    else:
      raise e

  finally:
    pass

def circle(x, y, d):
  r = d//2
  try:
    __shape = __canvas.create_oval(x + 1 - r, y + 1 - r, x + r, y + r, fill=__fill, outline=__outline, width=__width)
    __update()
    return __shape

  except Exception as e:
    if __canvas == None:
      pass;
    else:
      raise e

  finally:
    pass

def text(x, y, what, align="c", ang=0):
  try:
    __anchor = "center" if align == "c" else align
    __shape = __canvas.create_text(x + 1, y + 1, text=str(what), fill=__outline, font=(__font, __font_size, __font_modifiers), anchor=__anchor, angle=ang)
    __update()
    return __shape
  except Exception as e:
    if __canvas == None:
      pass;
    else:
      raise e

  finally:
    pass

def setFont(f=None, s=10, modifiers=""):
  global __font
  global __font_count, __font_size, __font_modifiers

  if f == None:
    __font = None
    return True
  else:
    try:

      modifiers = modifiers.lower()

      __font = f
      __font_size = s
      __font_modifiers = modifiers
      __font_count += 1
      return True
    except Exception as e:
      __font = None
      return False

def textWidth(s):
  try:
    return __font.measure(s)
  except:
    return -1

def lineSpace(s=""):
  try:
    return __font.metrics("linespace")
  except:
    return -1

def resize(w, h):
  global __background
  __master.geometry(f"{w}x{h}")
  __canvas.config(width=w, height=h)
  # Не видаляємо фон, а просто змінюємо його розмір
  __canvas.coords(__background, 0, 0, w+1, h+1)
  __canvas.itemconfig(__background, fill=__bgcolor, outline=__bgcolor)
  

def getWidth(what=None):
  if what == None:
    try:
      return int(__canvas['width'])
    except TypeError:
      return -1
  elif type(what) is tk.PhotoImage:
    return what.width()
  else:
    raise TypeError("Could not get the width of the provided object")

def getHeight(what=None):
  if what == None:
    try:
      return int(__canvas['height'])
    except TypeError:
      return -1
  elif type(what) is tk.PhotoImage:
    return what.height()
  else:
    raise TypeError("Could not get the height of the provided object")

def arc(x, y, w, h, s, e):
  try:
    __shape = __canvas.create_arc(x + 1, y + 1, x+1+w, y+1+h, start=s, extent=e, fill=__fill, outline=__outline, style=tk.ARC, width=__width)
    __update()
    return __shape
  except Exception as e:
    if __canvas == None:
      pass;
    else:
      raise e

  finally:
    pass

def pieSlice(x, y, w, h, s, e):
  try:
    __shape = __canvas.create_arc(x + 1, y + 1, x+1+w, y+1+h, start=s, extent=e, fill=__fill, outline=__outline, style=tk.PIESLICE, width=__width)
    __update()
    return __shape
  except Exception as e:
    if __canvas == None:
      pass;
    else:
      raise e

  finally:
    pass

def polygon(x1, y1=[], *args):
  try:
    if y1 != []:
      pts = [x1, y1]
      pts.extend(args)
    else:
      pts = list(x1)
      pts.extend(y1)
      pts.extend(args)

    for i in range(len(pts)):
      pts[i] = pts[i] + 1
    __shape = __canvas.create_polygon(pts, fill=__fill, outline=__outline, width=__width,smooth=False)
    __update()
    return __shape

  except Exception as e:
    if __canvas == None:
      pass;
    else:
      raise e

  finally:
    pass

def clear():
  try:
    __canvas.delete("all")
    __background = __canvas.create_rectangle(0, 0, getWidth(), getHeight(), fill=__bgcolor, outline=__bgcolor, tag="__background")
  except AttributeError:
    pass;

  __image_references.clear()
  __update()

def move(obj, x, y): 
  try:
    box = __canvas.bbox(obj)
    if box is None:
      return
    x1, y1, x2, y2 = box
    __canvas.move(obj, x-x1, y-y1)    
  except AttributeError:
    pass;

  __update()

def delete(obj):
  try:
    __canvas.delete(obj)   
  except AttributeError:
    pass;

  __update()

def scale(obj, xs, ys):
  try:
    parts = __canvas.coords(obj)
    if len(parts) < 2:
      return
    x1, y1 = parts[0], parts[1]
    __canvas.scale(obj, x1, y1, xs, ys)    
  except AttributeError:
    pass;

  __update()

def putUp(obj):
  try:
    __canvas.tag_raise(obj)   
  except AttributeError:
    pass;

  __update()

def putDown(obj):
  try:
    __canvas.tag_lower(obj)   
  except AttributeError:
    pass;

  __update()

def itemConfig(obj, **kwargs):
  try:
    __canvas.itemconfig(obj, **kwargs)  
  except AttributeError:
    pass;

  __update()

def checkCollision(obj1, obj2):
    try:
        box1 = __canvas.bbox(obj1)
        box2 = __canvas.bbox(obj2)

        if box1 is None or box2 is None:
            return False

        x1_min, y1_min, x1_max, y1_max = box1
        x2_min, y2_min, x2_max, y2_max = box2

        return (x1_max >= x2_min and
                x1_min <= x2_max and
                y1_max >= y2_min and
                y1_min <= y2_max)
    except AttributeError:
        return False

def setAutoUpdate(status):
  global __autoupdate
  __autoupdate = status

def version():
  return "1.0.11"

def createImage(w, h):
  retval = tk.PhotoImage(width=w, height=h)
  return retval

def loadImage(fname):
  retval = tk.PhotoImage(file=fname)
  return retval

def putPixel(img, x, y, r, g, b):
  img.put("#%02x%02x%02x" % (int(r), int(g), int(b)), to=(x,y))

def drawImage(img, x, y):
  global __image_references

  try:
    __shape = __canvas.create_image(x+1, y+1, image=img, anchor="nw")
    __image_references.add(img)
    __update()
    return __shape

  except Exception as e:
    if __canvas == None:
      pass;
    else:
      raise e

  finally:
    pass;

__init()
