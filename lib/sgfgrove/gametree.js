/**
 * @license sgfgrove-gametree 1.0.6
 * (c) 2015-2016 Ryo Anazawa https://github.com/anazawa/sgfgrove-gametree
 * Licence: MIT
 */
(function () {
    "use strict";

    var SGFGrove;

    var gameTree = function () {
        var that = gameTree.node();

        that.parse = function (tree, parent) {
            tree = tree || [[{}], []];

            var proto = parent ? parent.root() : this,
                other = proto.create(this.parseProperties(tree[0][0]), parent);

            var node = other,
                root = parent ? proto : other;

            for (var i = 1; i < tree[0].length; i++) {
                node = root.create(this.parseProperties(tree[0][i]), node);
            }

            for (var j = 0; j < tree[1].length; j++) {
                this.parse(tree[1][j], node);
            }

            return other;
        };

        that.parseProperties = function () {
            return arguments[0];
        };

        return that.parse.apply(that, arguments);
    };

    gameTree.node = function () {
        var that = gameTree.node.object();

        gameTree.node.serializable(that);
        gameTree.node.mutable(that);
        gameTree.node.cloneable(that);
        gameTree.node.iterable(that);

        that.defineAttribute("parent");
        that.defineAttribute("children");
        that.defineAttribute("properties");

        that.initialize = (function (superInitialize) {
            return function (properties, parent) {
                superInitialize.apply(this, arguments);
                this.parent(null);
                this.children([]);
                this.properties(properties || {});
                if (parent) {
                    parent.append(this);
                }
            };
        }(that.initialize));

        that.root = function () {
            var root = this;

            while (!root.isRoot()) {
                root = root.parent();
            }

            return root;
        };

        that.siblings = function () {
            return !this.isRoot() ? this.parent().children() : null;
        };

        that.isRoot = function () {
            return !this.parent();
        };

        that.isLeaf = function () {
            return !this.children().length;
        };

        that.depth = function () {
            var depth = 0;

            var node = this;
            while (!node.isRoot()) {
                node = node.parent();
                depth += 1;
            }

            return depth;
        };

        that.height = function () {
            var heights = [0];

            var children = this.children();
            for (var i = 0; i < children.length; i++) {
                heights[i+1] = children[i].height()+1;
            }

            return Math.max.apply(null, heights);
        };

        that.indexOf = function (child) {
            var children = this.children();
            for (var i = 0; i < children.length; i++) {
                if (children[i] === child) {
                    return i;
                }
            }
            return -1;
        };

        that.contains = function (other) {
            for (var node = other; node; node = node.parent()) {
                if (node === this) {
                    return true;
                }
            }
            return false;
        };

        return that.create.apply(that, arguments);
    };

    gameTree.node.serializable = function (that) {
        that = that || {};

        that.toSGF = function () {
            return [[this.properties()], this.children()];
        };

        that.toString = function (replacer, space) {
            if (this.isRoot()) {
                return SGFGrove.stringify([this], replacer, space);
            }
            throw new Error("Not a root node");
        };

        that.toJSON = function () {
            var sequence = [this.properties()];

            var node = this;
            while (node.children().length === 1) {
                node = node.children()[0];
                sequence.push(node.properties());
            }

            return [sequence, node.children()];
        };

        return that;
    };

    gameTree.node.mutable = function (that) {
        that = that || {};

        var insertAt = function (index, node) {
            if (node.contains(this)) {
                throw new Error("Ancestor node given");
            }
            node.detach();
            node.parent(this);
            this.children().splice(index, 0, node);
            return;
        };

        var removeAt = function (index) {
            var node = this.children().splice(index, 1)[0];
            node.parent(null);
            return node;
        };

        that.prepend = function (node) {
            insertAt.call(this, 0, node);
        };

        that.append = function (node) {
            insertAt.call(this, this.children().length, node);
        };

        that.detach = function () {
            var parent = this.parent();

            if (parent) {
                removeAt.call(parent, parent.indexOf(this));
            }

            return parent;
        };

        that.empty = function () {
            var children = this.children().slice(0);

            for (var i = 0; i < children.length; i++) {
                children[i].detach();
            }

            return children;
        };

        that.before = function (node) {
            var parent = this.parent();

            if (!parent) {
                throw new Error("Has no siblings");
            }

            insertAt.call(parent, parent.indexOf(this), node);

            return this;
        };

        that.after = function (node) {
            this.replaceWith(node);
            node.before(this);
            return this;
        };

        that.replaceWith = function (node) {
            var parent = this.parent();
            var index = parent && parent.indexOf(this);

            if (!parent) {
                throw new Error("Has no parent");
            }

            this.detach();
            insertAt.call(parent, index, node);

            return this;
        };

        return that;
    };

    gameTree.node.cloneable = function (that) {
        that = that || {};

        that.clone = function () {
            var other = this.root().create(this.cloneProperties());

            var children = this.children();
            for (var i = 0; i < children.length; i++) {
                other.append(children[i].clone());
            }

            return other;
        };

        that.cloneProperties = function () {
            var value = !arguments.length ? this.properties() : arguments[0];
            var copy;

            if (!value || typeof value !== "object") {
                copy = value;
            }
            else if (typeof value.clone === "function") {
                copy = value.clone();
            }
            else if (Array.isArray(value)) {
                copy = [];
                for (var i = 0; i < value.length; i++) {
                    copy[i] = this.cloneProperties(value[i]);
                }
            }
            else {
                copy = {};
                for (var key in value) {
                    if (value.hasOwnProperty(key)) {
                        copy[key] = this.cloneProperties(value[key]);
                    }
                }
            }

            return copy;
        };

        return that;
    };

    gameTree.node.iterable = function (that) {
        that = that || {};

        that.forEach = function (preorder, postorder, context) {
            var children = this.children();

            if (typeof preorder === "function") {
                preorder.call(context, this);
            }

            for (var i = 0; i < children.length; i++) {
                children[i].forEach(preorder, postorder, context);
            }

            if (typeof postorder === "function") {
                postorder.call(context, this);
            }

            return this;
        };

        that.find = function (criteria, context) {
            var stack = [this];
            while (stack.length) {
                var node = stack.shift();
                if (criteria.call(context, node)) {
                    return node;
                }
                stack = node.children().concat(stack);
            }
        };

        that.next = function () {
            if (!this.isLeaf()) {
                return this.children()[0];
            }

            for (var node = this; node; node = node.parent()) {
                var sibling = node.nextSibling();
                if (sibling) {
                    return sibling;
                }
            }

            return;
        };

        that.previous = function () {
            var node = this.previousSibling();

            if (!node) {
                return this.parent();
            }

            while (!node.isLeaf()) {
                var children = node.children();
                node = children[children.length-1];
            }

            return node;
        };

        that.nextSibling = function () {
            var parent = this.parent();
            var index = parent && parent.indexOf(this);
            return parent && parent.children()[index+1];
        };

        that.previousSibling = function () {
            var parent = this.parent();
            var index = parent && parent.indexOf(this);
            return parent && parent.children()[index-1];
        };

        return that;
    };

    gameTree.node.object = function () {
        var that = {};

        that.create = function () {
            var other = Object.create(this);
            other.initialize.apply(other, arguments);
            return other;
        };

        that.initialize = function () {
            this.$attributes = {};
        };

        that.defineAttribute = function (name) {
            this[name] = function () {
                if (arguments.length) {
                    this.$attributes[name] = arguments[0];
                    return this;
                }
                return this.$attributes[name];
            };
            return this;
        };

        return that.create.apply(that, arguments);
    };

    if (typeof exports !== "undefined") {
        SGFGrove = require("sgfgrove"); // jshint ignore:line
        module.exports = gameTree; // jshint ignore:line
    }
    else {
        SGFGrove = window.SGFGrove;
        SGFGrove.gameTree = gameTree;
    }

}());

