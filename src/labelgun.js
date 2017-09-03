
import rbush from "rbush";

export default 

/**
* @summary create a label gun instance with a hide and show label callback
* @param {function} hideLabel the function responsible for hiding the label on hide event
* @param {function} showLabel the function responsible for showing the label on show event
* @param {number} entries Higher value relates to faster insertion and slower search, and vice versa
*/
class labelgun {

 
  constructor(hideLabel, showLabel, entries) {

    const usedEntries = entries || 6;
    this.tree = rbush(usedEntries);
    this.allLabels = {};
    this._point = undefined;
    this.hasChanged = new Set();
    this.loaded = false;
    this.allChanged = false;
    this.hideLabel = hideLabel;
    this.showLabel = showLabel;

  }

  /**
   * @name _total
   * @summary get the total hidden or shown labels in the tree
   * @param {string} state whether to return 'hide' or 'show' state label totals
   * @returns {number} total number of labels of that state
   * @private
   */
  _total(state) {
    let total = 0;
    for (let keys in this.allLabels) {
      if (this.allLabels[keys].state == state) {
        total += 1;
      }
    }
    return total;
  }


  /**
   * @name totalShown
   * @memberof labelgun
   * @method
   * @summary Return the total number of shown labels
   * @returns {number} Return total number of labels shown
   * @public
   */
  totalShown() {
    return this._total("show");
  }


  /**
   * @name totalHidden
   * @memberof labelgun
   * @method
   * @summary Return the total number of hidden labels
   * @returns {number} Return total number of labels hidden
   * @public
   */
  totalHidden() {
    return this._total("hide");
  }

  /**
   * @name getLabelsByState
   * @summary Provided a state get all labels of that state
   * @param {string} state - the state of the labels to get (show or hide)
   * @returns {array} Labels that match the given state (show or hide)
   * @private
   */
  _getLabelsByState(state) {
    const labels = [];
    for (let keys in this.allLabels) {
      if (this.allLabels[keys].state == state) {
        labels.push(this.allLabels[keys]);
      }
    }
    return labels;
  }

  /**
   * @name getHidden
   * @memberof labelgun
   * @method
   * @summary Return an array of all the hidden labels
   * @returns {array} An array of hidden labels
   */
  getHidden() {
    return this._getLabelsByState("hide");
  }

  /**
   * @name getShown
   * @memberof labelgun
   * @method
   * @summary Return an array of all shown labels
   * @returns {array} An array of shown label
   */
  getShown() {
    return this._getLabelsByState("show");
  }

  /**
   * @name getCollisions
   * @memberof labelgun
   * @method
   * @summary Return a set of collisions (hidden and shown) for a given label
   * @param {string} id - the ID of the label to get
   * @returns {array} The list of collisions
   */
  getCollisions(id) {

    const label = this.allLabels[id];
    if (label === undefined) {
      throw Error("Label doesn't exist :" + JSON.stringify(id));
    }

    const collisions =  this.tree.search(label);
    const self = collisions.indexOf(label);

    // Remove the label if it's colliding with itself
    if (self !== undefined) collisions.splice(self, 1);
    return collisions;

  }

  /**
   * @name getLabel
   * @memberof labelgun
   * @method
   * @summary Convenience function to return a label by ID
   * @param {string} id the ID of the label to get
   * @returns {object} The label object for the id
   */
  getLabel(id) {
    return this.allLabels[id];
  }

  /**
   * @name destroy
   * @memberof labelgun
   * @method
   * @summary Destroy the collision tree and labels
   * @returns {undefined}
   */
  destroy() {
    this._resetTree();
    this.allLabels = {};
  }

  /**
   * @name callLabelCallbacks
   * @memberof labelgun
   * @method
   * @summary Perform the related callback for a label depending on where its state is 'show' or 'hide'
   * @param {string} [forceState] - the class of which to change the label to
   * @returns {undefined}
   */
  callLabelCallbacks(forceState) {
    Object.keys(this.allLabels).forEach(id => {
      this._callLabelStateCallback(this.allLabels[id], forceState);
    });
  }

  /**
   * @name _callLabelStateCallback
   * @summary Calls the correct callback for a particular label depending on its state (hidden or shown)
   * @param {string} label the label to update
   * @param {string} forceState the state of which to change the label to ('show' or 'hide')
   * @returns {undefined}
   * @private
   */
  _callLabelStateCallback(label, forceState) {
    const state = forceState || label.state;
    if (state === "show") this.showLabel(label);
    if (state === "hide") this.hideLabel(label);
  }

  calculate() {

    const highest = Object.values(this.allLabels).sort(this.compare);

    highest.forEach((label) => {

      const collisions = this.tree.search(label);
      const collisionsLower = this.allLower(collisions, label);

      if (collisions.length === 0 || collisionsLower) {
        this.allLabels[label.id].state = "show";
      }

    });

  }

  allLower(collisions, label) {
    let lower = true;
    for (let i = 0; i < collisions.length; i++) {
      var currentlyShowing = collisions[i].state === "show";
      var isLower = collisions[i].weight > label.weight;
      if (currentlyShowing || isLower) {
        lower = false;
      }
    }


    return lower;
  }


  compare(a,b) {
    // High to Low
    if (a.weight > b.weight)
      return -1;
    if (a.weight < b.weight)
      return 1;
    return 0;
  }

  /**
   * @name setupLabelStates
   * @memberof labelgun
   * @method
   * @summary Sets up the labels depending on whether all have changed or some have changed
   * @returns {undefined}
   */
  setupLabelStates() {

    if(this.allChanged) {
      this.allChanged = false;
      this.hasChanged.clear();
      this._resetTree();

      Object.keys(this.allLabels).forEach((id) => {

        const label = this.allLabels[id];
        //console.log(label.id);

        this.ingestLabel(
          {
            bottomLeft: [label.minX, label.minY],
            topRight: [label.maxX, label.maxY]
          },
          label.id,
          label.weight,
          label.labelObject,
          label.name,
          label.isDragged
        );
        
      });

    }
    else if(this.hasChanged.size) {
      const changed = [...this.hasChanged];
      this.hasChanged.clear();
      changed.forEach(id => {

        const label = this.allLabels[id];
        if (label) {
          this.ingestLabel(
            {
              bottomLeft: [label.minX, label.minY],
              topRight: [label.maxX, label.maxY]
            },
            label.id,
            label.weight,
            label.labelObject,
            label.name,
            label.isDragged
          );
        }
        

      });

    }

  }

  /**
   * @name update
   * @memberof labelgun
   * @method
   * @summary Sets all labels to change and reruns the whole show/hide procedure
   * @returns {undefined}
   */
  update() {

    this.allChanged = true;
    this.setupLabelStates();
    this.calculate();
    this.callLabelCallbacks();

  }

  /**
   * @name _handlePreviousCollisions
   * @memberof labelgun
   * @method
   * @summary Checks to see if a previously hidden/collided label is now able to be shown and then changes there state
   * @returns {undefined}
   * @private
   */
  _handlePreviousCollisions() {
    this.getHidden().forEach(hidden => {
      if (hidden.state === "hide") {

        const hiddenLabels = this.tree.search(hidden);

        if (hiddenLabels.length === 0) {
          hidden.state = "show";
        }

        // for (let i=0; i < hiddenLabels.length; i++){
        //   if (hiddenLabels[i].state !== "hide") {
        //     stillCollides = true;
        //     break;
        //   }
        // }

        // if (stillCollides === false) {
        //   hidden.state = "show";
        // }

      }
    });
  }

  /**
   * @name _resetTree
   * @memberof labelgun
   * @method
   * @summary Clears current tree containing all inputted labels
   * @returns {undefined}
   * @private
   */
  _resetTree() {
    this.tree.clear();
  }


  /**
   * @name _removeFromTree
   * @memberof labelgun
   * @method
   * @param {object} label - The label to remove from the tree
   * @param {boolean} forceUpdate if true, triggers all labels to be updated
   * @summary Removes label from tree
   * @returns {undefined}
   * @private
   */
  _removeFromTree(label, forceUpdate) {
    const id = label.id;
    const removelLabel = this.allLabels[id];
    this.tree.remove(removelLabel);
    delete this.allLabels[id];
    if (forceUpdate) this.callLabelCallbacks(true);
  }

  /**
   * @name _addToTree
   * @memberof labelgun
   * @method
   * @param {object} label - The label to add to the tree
   * @summary inserts label into tree
   * @returns {undefined}
   * @private
   */
  _addToTree(label) {
    if (label.id === undefined) throw Error("Label has no ID field : " + JSON.stringify(label))
    this.allLabels[label.id] = label;
    this.tree.insert(label);
  }

  _hideShownCollisions() {
    // This method shouldn't have to exist...
    this.getShown().forEach((label) => {
      this.getCollisions(label.id).forEach((collision) => {
        if (collision.state == "show") {
          collision.state = "hide";
        }
      });
    });
  }

  /**
   * @name _handleCollisions
   * @memberof labelgun
   * @method
   * @param {array} collisions - array of labels that have unresolved collisions
   * @param {object} label - label to handle collisions for
   * @param {boolean} isDragged - if label is currently being dragged
   * @summary Weighted collisions resolution for labels in the tree
   * @returns {undefined}
   * @private
   */
  _handleCollisions(collisions, label) {
    let originalWeight;
    if (label.isDragged) label.weight = Infinity;
    let highest = label;

    collisions.forEach(collision => {

      if (collision.isDragged) {
        originalWeight = collision.weight;

        // We set the dragged marker to the highest weight
        // and make its weight unbeatable (infinity)
        highest = collision;
        highest.weight = Infinity;
      }
 
      if (collision.weight > highest.weight) {
        highest = collision;
      } 

      collision.state = "hide";
      
    });

    highest.state = "show";

    if (originalWeight !== undefined) highest.weight = originalWeight;
  }

  /**
   * @name ingestLabel
   * @memberof labelgun
   * @method
   * @param {object} boundingBox - The bounding box object with bottomLeft and topRight properties
   * @param {string} id - The idea of the label
   * @param {number} weight - The weight to calculate in the collision resolution
   * @param {object} labelObject - The object representing the actual label object from your mapping library
   * @param {string} labelName - A string depicting the name of the label
   * @param {boolean} isDragged - A flag to say whether the lable is being dragged
   * @summary Creates a label if it does not already exist, then adds it to the tree, and renders it based on whether it can be shown
   * @returns {undefined} 
   */
  ingestLabel(boundingBox, id, weight, labelObject, labelName, isDragged) {

    // Add the new label to the tree
    if (weight === undefined || weight === null) {
      weight = 0;
    } 

    if (!boundingBox || !boundingBox.bottomLeft || !boundingBox.topRight) {
      throw Error("Bounding box must be defined with bottomLeft and topRight properties");
    }

    if (typeof id !== "string" && typeof id !== "number") {
      throw Error("Label IDs must be a string or a number");
    }

    // If there is already a label in the tree, remove it
    const oldLabel = this.allLabels[id];
    if (oldLabel) this._removeFromTree(oldLabel);

    const label = {
      minX: boundingBox.bottomLeft[0],
      minY: boundingBox.bottomLeft[1],
      maxX: boundingBox.topRight[0],
      maxY: boundingBox.topRight[1],
      state: "hide",
      id : id,
      weight: weight,
      labelObject : labelObject,
      name : labelName,
      isDragged : isDragged
    };

    this._addToTree(label);

    // Get all of its collisions

    const collisions = this.getCollisions(id);
    if (label.name === "Ohio") console.log(label.name, collisions)

    // If the collisions are non existance we can show it
    if (collisions.length === 0) {
      label.state = "show";
      return;
    }

    // Else we need to handle the collisions and decide which one to show
    //this._handleCollisions(collisions, label, isDragged);

  }

  /**
   * @name labelHasChanged
   * @memberof labelgun
   * @param id - The id of the label that has changed in some way
   * @method
   * @summary Let labelgun know the label has changed in some way (i.e. it's state for example, or that it is dragged)
   * @returns {undefined}
   */
  labelHasChanged(id) {
    this.hasChanged.add(id);
  }

}

