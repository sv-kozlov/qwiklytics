.PHONY: tree
tree:
	tree -L 3 -I "node_modules|build|dist|*.map|*.js|package-lock.json"
