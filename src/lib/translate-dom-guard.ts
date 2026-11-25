/**
 * Browser translators (Google Translate, Edge, Safari) replace text nodes with
 * <font> wrappers behind React's back. When React later removes or inserts
 * next to a node it still holds, the DOM throws "Failed to execute
 * 'removeChild' on 'Node': The node to be removed is not a child of this
 * node." and the whole tree unmounts (Viziera, 2026-11-24: a visitor on "/"
 * using a translated page). Treat those two calls as no-ops when the node has
 * moved, as https://github.com/facebook/react/issues/11538 suggests.
 */
export function installTranslateDomGuard(proto: typeof Node.prototype = Node.prototype) {
  const marked = proto as typeof proto & { __openeyeTranslateGuard?: true };
  if (marked.__openeyeTranslateGuard) return;
  marked.__openeyeTranslateGuard = true;

  const removeChild = proto.removeChild;
  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return removeChild.call(this, child) as T;
  };

  const insertBefore = proto.insertBefore;
  proto.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) return insertBefore.call(this, node, null) as T;
    return insertBefore.call(this, node, ref) as T;
  };
}
