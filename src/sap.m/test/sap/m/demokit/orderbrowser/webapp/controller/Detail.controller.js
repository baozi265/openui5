/*global location */
sap.ui.define([
		"sap/ui/demo/orderbrowser/controller/BaseController",
		"sap/ui/model/json/JSONModel",
		"sap/ui/demo/orderbrowser/model/formatter"
	], function (BaseController, JSONModel, formatter) {
		"use strict";
		function _calculateOrderTotal (fPreviousTotal, oCurrentContext) {
			var fItemTotal = oCurrentContext.getObject().Quantity * oCurrentContext.getObject().UnitPrice;
			return fPreviousTotal + fItemTotal;
		}
		return BaseController.extend("sap.ui.demo.orderbrowser.controller.Detail", {

			formatter: formatter,

			/* =========================================================== */
			/* lifecycle methods                                           */
			/* =========================================================== */

			onInit : function () {
				// Model used to manipulate control states. The chosen values make sure,
				// detail page is busy indication immediately so there is no break in
				// between the busy indication for loading the view's meta data
				this._aValidKeys = ["shipping", "processor"];
				var oViewModel = new JSONModel({
					busy : false,
					delay : 0,
					lineItemListTitle : this.getResourceBundle().getText("detailLineItemTableHeading"),
					// Set fixed currency on view model (as the OData service does not provide a currency).
					currency : "EUR",
					// the sum of all items of this order
					totalOrderAmount: 0,
					selectedTab: ""
				});

				this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);

				this.setModel(oViewModel, "detailView");

				this.getOwnerComponent().getModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));
			},

			/* =========================================================== */
			/* event handlers                                              */
			/* =========================================================== */

			/**
			 * Event handler when the share by E-Mail button has been clicked
			 * @public
			 */
			onShareEmailPress : function () {
				var oViewModel = this.getModel("detailView");

				sap.m.URLHelper.triggerEmail(
					null,
					oViewModel.getProperty("/shareSendEmailSubject"),
					oViewModel.getProperty("/shareSendEmailMessage")
				);
			},


			/**
			 * Updates the item count within the line item table's header
			 * @param {object} oEvent an event containing the total number of items in the list
			 * @private
			 */
			onListUpdateFinished : function (oEvent) {
				var sTitle,
					fOrderTotal = 0,
					iTotalItems = oEvent.getParameter("total"),
					oViewModel = this.getModel("detailView"),
					oItemsBinding = oEvent.getSource().getBinding("items"),
					aItemsContext;

				// only update the counter if the length is final
//				if (this.byId("lineItemsList").getBinding("items").isLengthFinal()) {
				if (oItemsBinding.isLengthFinal()) {
					if (iTotalItems) {
						sTitle = this.getResourceBundle().getText("detailLineItemTableHeadingCount", [iTotalItems]);
					} else {
						//Display 'Line Items' instead of 'Line items (0)'
						sTitle = this.getResourceBundle().getText("detailLineItemTableHeading");
					}
					oViewModel.setProperty("/lineItemListTitle", sTitle);

					aItemsContext = oItemsBinding.getContexts();
					fOrderTotal = aItemsContext.reduce(_calculateOrderTotal, 0);
					oViewModel.setProperty("/totalOrderAmount", fOrderTotal);
				}
//				function _calculateOrderTotal (fPreviousTotal, oCurrentContext, iCurrentIndex, aItemsContext) {
//					//var fItemTotal = 0;
//					var fItemTotal = oCurrentContext.getObject().Quantity * oCurrentContext.getObject().UnitPrice;
//					return fPreviousTotal + fItemTotal;
//				}
			},

			/* =========================================================== */
			/* begin: internal methods                                     */
			/* =========================================================== */

//			_calculateOrderTotal : function (fPreviousTotal, oCurrentContext, iCurrentIndex, aItemsContext) {
//				var fItemTotal = 0;
//				fItemTotal = oCurrentContext.getObject().Quantiy * oCurrentContext.getObject().UnitPrice;
//				return fPreviousTotal + fItemTotal;
//			},

			/**
			 * Binds the view to the object path and expands the aggregated line items.
			 * @function
			 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
			 * @private
			 */
			_onObjectMatched : function (oEvent) {
				var oArguments = oEvent.getParameter("arguments");
				this._sObjectId = oArguments.objectId;
				this.getModel().metadataLoaded().then( function() {
					var sObjectPath = this.getModel().createKey("Orders", {
						OrderID :  this._sObjectId
					});
					this._bindView("/" + sObjectPath);
				}.bind(this));
				var oQuery  = oArguments["?query"];
				if(oQuery && this._aValidKeys.indexOf(oQuery.tab) >=0){
					this.getView().getModel("detailView").setProperty("/selectedTab", oQuery.tab);
					this.getRouter().getTargets().display(oQuery.tab);
				}
				else{
					this.getRouter().navTo("object", {
						objectId: this._sObjectId,
						query: {
							tab: "shipping"
						}
					}, true);
				}
			},

			/**
			 * Binds the view to the object path. Makes sure that detail view displays
			 * a busy indicator while data for the corresponding element binding is loaded.
			 * @function
			 * @param {string} sObjectPath path to the object to be bound to the view.
			 * @private
			 */
			_bindView : function (sObjectPath) {
				// Set busy indicator during view binding
				var oViewModel = this.getModel("detailView");

				// If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
				oViewModel.setProperty("/busy", false);

				this.getView().bindElement({
					path : sObjectPath,
					parameters: {
						expand: "Customer,Order_Details/Product,Employee"
					},
					events: {
						change : this._onBindingChange.bind(this),
						dataRequested : function () {
							oViewModel.setProperty("/busy", true);
						},
						dataReceived: function () {
							oViewModel.setProperty("/busy", false);
						}
					}
				});
			},

			_onBindingChange : function () {
				var oView = this.getView(),
					oElementBinding = oView.getElementBinding();

				// No data for the binding
				if (!oElementBinding.getBoundContext()) {
					this.getRouter().getTargets().display("detailObjectNotFound");
					// if object could not be found, the selection in the master list
					// does not make sense anymore.
					this.getOwnerComponent().oListSelector.clearMasterListSelection();
					return;
				}

				var sPath = oElementBinding.getPath(),
					oResourceBundle = this.getResourceBundle(),
					oObject = oView.getModel().getObject(sPath),
					sObjectId = oObject.OrderID,
					sObjectName = oObject.OrderID,
					oViewModel = this.getModel("detailView");

				this.getOwnerComponent().oListSelector.selectAListItem(sPath);

				oViewModel.setProperty("/shareSendEmailSubject",
					oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
				oViewModel.setProperty("/shareSendEmailMessage",
					oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));
			},

			_onMetadataLoaded : function () {
				// Store original busy indicator delay for the detail view
				var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay(),
					oViewModel = this.getModel("detailView"),
					oLineItemTable = this.byId("lineItemsList"),
					iOriginalLineItemTableBusyDelay = oLineItemTable.getBusyIndicatorDelay();

				// Make sure busy indicator is displayed immediately when
				// detail view is displayed for the first time
				oViewModel.setProperty("/delay", 0);
				oViewModel.setProperty("/lineItemTableDelay", 0);

				oLineItemTable.attachEventOnce("updateFinished", function() {
					// Restore original busy indicator delay for line item table
					oViewModel.setProperty("/lineItemTableDelay", iOriginalLineItemTableBusyDelay);
				});

				// Binding the view will set it to not busy - so the view is always busy if it is not bound
				oViewModel.setProperty("/busy", true);
				// Restore original busy indicator delay for the detail view
				oViewModel.setProperty("/delay", iOriginalViewBusyDelay);
			},
			onTabSelect : function(oEvent){
				var sSelectedTab = oEvent.getParameter("selectedKey");
				this.getRouter().navTo("object", {
					objectId: this._sObjectId,
					query: {
						tab: sSelectedTab
					}
				}, true);// true without history

			},

			_onHandleTelephonePress : function (oEvent){
				var sNumber = oEvent.getSource().getText();
				sap.m.URLHelper.triggerTel(sNumber);
			}

		});

	}
);