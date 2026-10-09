package org.dataflowanalysis.standalone.mitigation.approaches;

import java.util.ArrayList;
import java.util.List;

import org.dataflowanalysis.analysis.dsl.AnalysisConstraint;
import org.dataflowanalysis.converter.dfd2web.DataFlowDiagramAndDictionary;
import org.dataflowanalysis.standalone.mitigation.MitigationOption;
import org.dataflowanalysis.standalone.mitigation.MitigationService;

import dev.arcovia.mitigation.ilp.Constraint;
import dev.arcovia.mitigation.ilp.MitigationType;
import dev.arcovia.mitigation.ilp.OptimizationManager;
import dev.arcovia.mitigation.ilp.MitigationStrategy;
import dev.arcovia.mitigation.sat.Label;
import dev.arcovia.mitigation.sat.NodeLabel;
import dev.arcovia.mitigation.sat.OutgoingDataLabel;
import dev.arcovia.mitigation.sat.CompositeLabel;
import dev.arcovia.mitigation.sat.IncomingDataLabel;

public class ILPService extends MitigationService{
    protected DataFlowDiagramAndDictionary repair(DataFlowDiagramAndDictionary dd, List<AnalysisConstraint> constraints, List<MitigationOption> options) throws Exception {
        OptimizationManager optimization;
        if (!options.isEmpty()) {
            var cons = convertMitigationToConstraints(options, constraints);
            optimization = new OptimizationManager(dd, cons, false);
        } else {
            optimization = new OptimizationManager(dd, constraints);
        }
        return optimization.repair();
    }
    
    private List<Constraint> convertMitigationToConstraints(List<MitigationOption> options, List<AnalysisConstraint> constraints) {
        return constraints.stream().map((constraint) -> {
            var strategies = options.stream().filter((option) -> option.forConstraint().equals(constraint.getName())).map(this::getStrategyFromOption).toList();
            
            return new Constraint(constraint, strategies);
        }).toList();
    }
    
    private MitigationStrategy getStrategyFromOption(MitigationOption option) {        
        return new MitigationStrategy(getLabelFromString(option), 0, inferMitigationtype(option));
    }
    
    private MitigationType inferMitigationtype(MitigationOption option) {
        switch (option.type()) {
        case "Delete Label":{    
            switch (option.typeOfLabel()) {
            case "Node": return MitigationType.DeleteNodeLabel;
            case "Outgoing": return MitigationType.DeleteDataLabel; 
            default: throw new IllegalArgumentException("Cant delete incoming Label");           
            } 
        }
        case "Add Label": {    
            switch (option.typeOfLabel()) {
            case "Node": return MitigationType.NodeLabel;
            case "Outgoing": return MitigationType.DataLabel;     
            default: throw new IllegalArgumentException("Cant add incoming Label");      
            } 
        }
        case "Delete Node with Label":   
            return MitigationType.DeleteNode;         
        case "Add Node with Label":
            return MitigationType.AddNode;
        case "Delete Flow with Label": 
            return MitigationType.DeleteFlow;
        case "Add Sink":
            return MitigationType.AddSink;
        default:
            throw new IllegalArgumentException("Unexpected value: " + option.type());
        }
    }
    
    private List<CompositeLabel> getLabelFromString(MitigationOption option) {
        if(option.typeOfLabel().equals("Node"))
            return option.labels()
                    .stream()
                    .<CompositeLabel>map(label -> new NodeLabel(
                            new Label(label.labelType(), label.label())
                    ))
                    .toList();
        else if(option.typeOfLabel().equals("Incoming"))
            return option.labels()
                    .stream()
                    .<CompositeLabel>map(label -> new IncomingDataLabel(
                            new Label(label.labelType(), label.label())
                    ))
                    .toList();
        else 
            return option.labels()
                    .stream()
                    .<CompositeLabel>map(label -> new OutgoingDataLabel(
                            new Label(label.labelType(), label.label())
                    ))
                    .toList();
    }
}
